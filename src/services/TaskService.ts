import { db } from '../db';
import { TaskRepository, PendingOperationRepository } from '../db/repository';
import type { NewTaskData, Task } from '../types';
import uuid from 'react-native-uuid';
import { TaskCompletionStatusEnum } from '../types';
import { syncService } from './SyncService';

export class TaskService {
  private taskRepo: TaskRepository;
  private pendingOpRepo: PendingOperationRepository;

  constructor() {
    this.taskRepo = new TaskRepository(db);
    this.pendingOpRepo = new PendingOperationRepository(db);
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.taskRepo.getTaskById(id);
  }

  async getTasksForDate(date: Date): Promise<Task[]> {
    return this.taskRepo.getTasksForDate(date);
  }

  async getCountOfTasksOverdue(): Promise<number> {
    return this.taskRepo.getCountOfTasksOverdue();
  }

  async getAllOverdueTasks(): Promise<Task[]> {
    return this.taskRepo.getAllOverdueTasks();
  }

  /**
   * Creates a new task.
   * If the user is logged in, it uses the Outbox Pattern to ensure the local
   * database write and the sync operation are queued atomically.
   * @param taskData The data for the new task.
   * @param isLoggedIn The current authentication status of the user.
   * @returns The UUID of the newly created task.
   */
  async createTask(
    taskData: NewTaskData,
    userId: string | null,
  ): Promise<string> {
    if (!userId) {
      console.log('[TaskService] Offline user. Writing to local DB only.');
      return await this.taskRepo.createTask(taskData);
    }

    console.log('[TaskService] Logged-in user. Using transactional outbox.');

    const now = new Date();
    const newId = uuid.v4() as string; // Generate ID upfront to use in both tables

    const localTaskPayload = { ...taskData, id: newId };

    const remoteTaskPayload = {
      id: newId,
      isActive: true,
      title: taskData.title,
      description: taskData.description || '',
      schedule: taskData.schedule,
      priority: 3,
      completionStatus: TaskCompletionStatusEnum.INCOMPLETE, // Default for new task
      dueDate: taskData.dueDate ? taskData.dueDate.toISOString() : null,
      shouldBeScored: taskData.shouldBeScored === 1,
      score: null,
      timeOfDay: taskData.timeOfDay,
      repetitiveTaskTemplateId: taskData.repetitiveTaskTemplateId || null,
      createdAt: now.toISOString(),
      modifiedAt: now.toISOString(),
      tags: [],
      spaceId: taskData.spaceId,
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      await this.taskRepo._internalAddTask(localTaskPayload);

      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'create',
        entity_type: 'task',
        entity_id: newId,
        payload: JSON.stringify(remoteTaskPayload),
        userId,
      });

      await db.executeAsync('COMMIT;');
      console.log(
        `[TaskService] Transaction for creating task ${newId} committed successfully.`,
      );

      syncService.runSync();

      return newId;
    } catch (error) {
      console.error(
        `[TaskService] Transaction for creating task ${newId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async updateTask(
    taskId: string,
    taskData: NewTaskData,
    userId: string | null,
  ): Promise<void> {
    if (!userId) {
      console.log('[TaskService] Offline user. Updating local DB only.');
      await this.taskRepo.updateTaskById(taskId, taskData);
      return;
    }

    console.log(
      '[TaskService] Logged-in user. Using transactional outbox for update.',
    );

    const now = new Date();

    const originalTask = await this.taskRepo.getTaskById(taskId);
    if (!originalTask) {
      throw new Error(
        `[TaskService] Cannot update non-existent task with ID ${taskId}`,
      );
    }

    const remoteTaskPayload = {
      id: taskId,
      isActive: true,
      title: taskData.title,
      description: taskData.description || '',
      schedule: taskData.schedule,
      priority: 3,
      completionStatus: TaskCompletionStatusEnum.INCOMPLETE,
      dueDate: taskData.dueDate ? taskData.dueDate.toISOString() : null,
      shouldBeScored: taskData.shouldBeScored === 1,
      score: null,
      timeOfDay: taskData.timeOfDay,
      repetitiveTaskTemplateId: taskData.repetitiveTaskTemplateId || null,
      createdAt: originalTask.createdAt,
      modifiedAt: now.toISOString(),
      tags: [],
      spaceId: taskData.spaceId,
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');
      await this.taskRepo.updateTaskById(taskId, taskData);
      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'update',
        entity_type: 'task',
        entity_id: taskId,
        payload: JSON.stringify(remoteTaskPayload),
        userId,
      });
      await db.executeAsync('COMMIT;');
      console.log(
        `[TaskService] Transaction for updating task ${taskId} committed.`,
      );

      syncService.runSync();
    } catch (error) {
      console.error(
        `[TaskService] Transaction for updating task ${taskId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async bulkFailTasks(taskIds: string[], userId: string | null): Promise<void> {
    if (taskIds.length === 0) {
      console.log('[TaskService] bulkFailTasks called with no task IDs.');
      return;
    }

    if (!userId) {
      console.log('[TaskService] Offline user. Bulk failing tasks locally.');
      await this.taskRepo.bulkFailTasks(taskIds);
      return;
    }

    console.log(
      '[TaskService] Logged-in user. Using transactional outbox for bulk fail.',
    );

    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      await this.taskRepo.bulkFailTasks(taskIds);

      for (const taskId of taskIds) {
        const originalTask = await this.taskRepo.getTaskById(taskId);
        if (originalTask) {
          const remoteTaskPayload = {
            ...originalTask,
            completionStatus: TaskCompletionStatusEnum.FAILED,
            modifiedAt: new Date().toISOString(),
          };

          await this.pendingOpRepo.enqueueOperation({
            operation_type: 'update',
            entity_type: 'task',
            entity_id: taskId,
            payload: JSON.stringify(remoteTaskPayload),
            userId,
          });
        }
      }

      await db.executeAsync('COMMIT;');
      console.log(
        '[TaskService] Transaction for bulk failing tasks committed.',
      );

      syncService.runSync();
    } catch (error) {
      console.error(
        '[TaskService] Transaction for bulk failing tasks failed. Rolling back.',
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async failAllOverdueTasksAtOnce(userId: string | null): Promise<void> {
    const overdueTasks = await this.taskRepo.getAllOverdueTasks();
    if (overdueTasks.length === 0) {
      console.log('[TaskService] No overdue tasks to fail.');
      return;
    }

    const taskIds = overdueTasks.map(task => task.id);

    if (!userId) {
      console.log(
        '[TaskService] Offline user. Failing all overdue tasks locally.',
      );
      await this.taskRepo.failAllOverdueTasksAtOnce();
      return;
    }

    console.log(
      '[TaskService] Logged-in user. Failing all overdue tasks with outbox.',
    );

    try {
      await this.bulkFailTasks(taskIds, userId);
      console.log('[TaskService] All overdue tasks failed successfully.');
    } catch (error) {
      console.error('[TaskService] Failed to fail all overdue tasks.', error);
      throw error;
    }
  }

  async updateTaskCompletionStatus(
    taskId: string,
    status: TaskCompletionStatusEnum,
    userId: string | null,
    score?: number | null,
  ): Promise<void> {
    if (!userId) {
      console.log(
        '[TaskService] Offline user. Updating task completion status locally.',
      );
      await this.taskRepo.updateTaskCompletionStatus(taskId, status, score);
      return;
    }

    console.log(
      '[TaskService] Logged-in user. Using transactional outbox for completion status update.',
    );

    const originalTask = await this.taskRepo.getTaskById(taskId);
    if (!originalTask) {
      throw new Error(
        `[TaskService] Cannot update completion status for non-existent task with ID ${taskId}`,
      );
    }

    const remoteTaskPayload = {
      ...originalTask,
      completionStatus: status,
      score: score === undefined ? originalTask.score : score,
      modifiedAt: new Date().toISOString(),
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');
      await this.taskRepo.updateTaskCompletionStatus(taskId, status, score);
      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'update',
        entity_type: 'task',
        entity_id: taskId,
        payload: JSON.stringify(remoteTaskPayload),
        userId,
      });
      await db.executeAsync('COMMIT;');

      syncService.runSync();
    } catch (error) {
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async updateTaskDueDate(
    taskId: string,
    dueDate: Date,
    userId: string | null,
  ): Promise<void> {
    if (!userId) {
      console.log('[TaskService] Offline user. Updating due date locally.');
      await this.taskRepo.updateTaskDueDate(taskId, dueDate);
      return;
    }

    console.log(
      '[TaskService] Logged-in user. Using transactional outbox for due date update.',
    );

    const originalTask = await this.taskRepo.getTaskById(taskId);
    if (!originalTask) {
      throw new Error(
        `[TaskService] Cannot update due date for non-existent task with ID ${taskId}`,
      );
    }

    const remoteTaskPayload = {
      ...originalTask,
      dueDate: dueDate.toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');
      await this.taskRepo.updateTaskDueDate(taskId, dueDate);
      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'update',
        entity_type: 'task',
        entity_id: taskId,
        payload: JSON.stringify(remoteTaskPayload),
        userId,
      });
      await db.executeAsync('COMMIT;');

      syncService.runSync();
    } catch (error) {
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async getActiveTasksByRepetitiveTaskTemplateId(
    templateId: string,
    days?: number,
  ): Promise<Task[]> {
    return this.taskRepo.getActiveTasksByRepetitiveTaskTemplateId(
      templateId,
      days,
    );
  }

  async countAllActiveTasksByCategory() {
    return this.taskRepo.countAllActiveTasksByCategory();
  }

  async countActiveTasksBySpaceId(spaceId: string) {
    return this.taskRepo.countActiveTasksBySpaceId(spaceId);
  }

  async getActiveUnscheduledTasksBySpace(spaceId: string): Promise<Task[]> {
    console.log(
      `[TaskService] Getting active unscheduled tasks for space ID: ${spaceId}`,
    );
    return this.taskRepo.getActiveUnscheduledTasksBySpace(spaceId);
  }

  async getActiveOnceTasksBySpace(spaceId: string): Promise<Task[]> {
    console.log(
      `[TaskService] Getting active 'once' tasks for space ID: ${spaceId}`,
    );
    return this.taskRepo.getActiveOnceTasksBySpace(spaceId);
  }

  async getAllActiveUnscheduledTasks(): Promise<Task[]> {
    console.log('[TaskService] Getting all active unscheduled tasks');
    return this.taskRepo.getAllActiveUnscheduledTasks();
  }

  async getAllActiveOnceTasks(): Promise<Task[]> {
    console.log("[TaskService] Getting all active 'once' tasks");
    return this.taskRepo.getAllActiveOnceTasks();
  }
}

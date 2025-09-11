import { db } from '../db';
import { TaskRepository, PendingOperationRepository } from '../db/repository';
import type { NewTaskData, Task } from '../types';
import uuid from 'react-native-uuid';
import { TaskCompletionStatusEnum } from '../types';

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
    isLoggedIn: boolean,
  ): Promise<string> {
    if (!isLoggedIn) {
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
      });

      await db.executeAsync('COMMIT;');
      console.log(
        `[TaskService] Transaction for creating task ${newId} committed successfully.`,
      );

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
    isLoggedIn: boolean,
  ): Promise<void> {
    if (!isLoggedIn) {
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
      });
      await db.executeAsync('COMMIT;');
      console.log(
        `[TaskService] Transaction for updating task ${taskId} committed.`,
      );
    } catch (error) {
      console.error(
        `[TaskService] Transaction for updating task ${taskId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async updateTaskCompletionStatus(
    taskId: string,
    status: TaskCompletionStatusEnum,
    isLoggedIn: boolean,
    score?: number | null,
  ): Promise<void> {
    if (!isLoggedIn) {
      console.log(
        '[TaskService] Offline user. Updating task completion status locally.',
      );
      await this.taskRepo.updateTaskCompletionStatus(taskId, status, score);
      return;
    }

    console.log(
      '[TaskService] Logged-in user. Using transactional outbox for completion status update.',
    );

    // For sync, we need the full task payload for the backend.
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
      });
      await db.executeAsync('COMMIT;');
    } catch (error) {
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async updateTaskDueDate(
    taskId: string,
    dueDate: Date,
    isLoggedIn: boolean,
  ): Promise<void> {
    if (!isLoggedIn) {
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
      });
      await db.executeAsync('COMMIT;');
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
}

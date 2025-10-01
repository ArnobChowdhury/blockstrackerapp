import { db } from '../db';
import { TaskRepository, PendingOperationRepository } from '../db/repository';
import type { NewTaskData, Task } from '../types';
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
   * @param userId The userId of the user.
   * @returns The UUID of the newly created task.
   */
  async createTask(
    taskData: NewTaskData,
    userId: string | null,
  ): Promise<string> {
    let newId: string;
    let newTask: Task;
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      newTask = await this.taskRepo.createTask(taskData, userId);
      newId = newTask.id;

      if (userId) {
        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operation.',
        );

        await this.pendingOpRepo.enqueueOperation({
          userId: userId,
          operation_type: 'create',
          entity_type: 'task',
          entity_id: newId,
          payload: JSON.stringify({ ...newTask, tags: [] }),
        });
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        '[TaskService] Transaction for creating task failed. Rolling back.',
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
    return newId;
  }

  async updateTask(
    taskId: string,
    taskData: NewTaskData,
    userId: string | null,
  ): Promise<void> {
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      const updatedTask = await this.taskRepo.updateTaskById(
        taskId,
        taskData,
        userId,
      );

      if (userId) {
        if (!updatedTask) {
          throw new Error(
            `[TaskService] Cannot update non-existent or unauthorized task with ID ${taskId}`,
          );
        }

        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operation for update.',
        );

        const remoteTaskPayload = { ...updatedTask, tags: [] };

        await this.pendingOpRepo.enqueueOperation({
          operation_type: 'update',
          entity_type: 'task',
          entity_id: taskId,
          payload: JSON.stringify(remoteTaskPayload),
          userId,
        });
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
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
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      const updatedTask = await this.taskRepo.updateTaskCompletionStatus(
        taskId,
        status,
        userId,
        score,
      );

      if (userId) {
        if (!updatedTask) {
          throw new Error(
            `[TaskService] Cannot update completion status for non-existent or unauthorized task with ID ${taskId}`,
          );
        }

        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operation for completion status update.',
        );

        const remoteTaskPayload = { ...updatedTask, tags: [] };

        await this.pendingOpRepo.enqueueOperation({
          operation_type: 'update',
          entity_type: 'task',
          entity_id: taskId,
          payload: JSON.stringify(remoteTaskPayload),
          userId,
        });
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        `[TaskService] Transaction for updating task completion status for ${taskId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async updateTaskDueDate(
    taskId: string,
    dueDate: Date,
    userId: string | null,
  ): Promise<void> {
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      const updatedTask = await this.taskRepo.updateTaskDueDate(
        taskId,
        dueDate,
        userId,
      );

      if (userId) {
        if (!updatedTask) {
          throw new Error(
            `[TaskService] Cannot update due date for non-existent or unauthorized task with ID ${taskId}`,
          );
        }

        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operation for due date update.',
        );

        const remoteTaskPayload = { ...updatedTask, tags: [] };

        await this.pendingOpRepo.enqueueOperation({
          operation_type: 'update',
          entity_type: 'task',
          entity_id: taskId,
          payload: JSON.stringify(remoteTaskPayload),
          userId,
        });
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        `[TaskService] Transaction for updating task due date for ${taskId} failed. Rolling back.`,
        error,
      );
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

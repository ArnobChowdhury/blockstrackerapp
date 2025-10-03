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

  async getTaskById(id: string, userId: string | null): Promise<Task | null> {
    return this.taskRepo.getTaskById(id, userId);
  }

  async getTasksForDate(date: Date, userId: string | null): Promise<Task[]> {
    return this.taskRepo.getTasksForDate(date, userId);
  }

  async getCountOfTasksOverdue(userId: string | null): Promise<number> {
    return this.taskRepo.getCountOfTasksOverdue(userId);
  }

  async getAllOverdueTasks(userId: string | null): Promise<Task[]> {
    return this.taskRepo.getAllOverdueTasks(userId);
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

    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      const updatedTasks = await this.taskRepo.bulkFailTasks(taskIds, userId);

      if (userId) {
        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operations for bulk fail.',
        );
        for (const task of updatedTasks) {
          const remoteTaskPayload = { ...task, tags: [] };
          await this.pendingOpRepo.enqueueOperation({
            operation_type: 'update',
            entity_type: 'task',
            entity_id: task.id,
            payload: JSON.stringify(remoteTaskPayload),
            userId,
          });
        }
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
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
    try {
      await db.executeAsync('BEGIN TRANSACTION;');
      const failedTasks = await this.taskRepo.failAllOverdueTasksAtOnce(userId);

      if (userId && failedTasks.length > 0) {
        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operations for all overdue tasks.',
        );
        for (const task of failedTasks) {
          const remoteTaskPayload = { ...task, tags: [] };
          await this.pendingOpRepo.enqueueOperation({
            operation_type: 'update',
            entity_type: 'task',
            entity_id: task.id,
            payload: JSON.stringify(remoteTaskPayload),
            userId,
          });
        }
      }
      await db.executeAsync('COMMIT;');
      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        '[TaskService] Transaction for failing all overdue tasks failed. Rolling back.',
        error,
      );
      await db.executeAsync('ROLLBACK;');
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
    userId: string | null,
    days?: number,
  ): Promise<Task[]> {
    return this.taskRepo.getActiveTasksByRepetitiveTaskTemplateId(
      templateId,
      userId,
      days,
    );
  }

  async countAllActiveTasksByCategory(userId: string | null) {
    return this.taskRepo.countAllActiveTasksByCategory(userId);
  }

  async countActiveTasksBySpaceId(spaceId: string, userId: string | null) {
    return this.taskRepo.countActiveTasksBySpaceId(spaceId, userId);
  }

  async getActiveUnscheduledTasksBySpace(
    spaceId: string,
    userId: string | null,
  ): Promise<Task[]> {
    console.log(
      `[TaskService] Getting active unscheduled tasks for space ID: ${spaceId}`,
    );
    return this.taskRepo.getActiveUnscheduledTasksBySpace(spaceId, userId);
  }

  async getActiveOnceTasksBySpace(
    spaceId: string,
    userId: string | null,
  ): Promise<Task[]> {
    console.log(
      `[TaskService] Getting active 'once' tasks for space ID: ${spaceId}`,
    );
    return this.taskRepo.getActiveOnceTasksBySpace(spaceId, userId);
  }

  async getAllActiveUnscheduledTasks(userId: string | null): Promise<Task[]> {
    console.log('[TaskService] Getting all active unscheduled tasks');
    return this.taskRepo.getAllActiveUnscheduledTasks(userId);
  }

  async getAllActiveOnceTasks(userId: string | null): Promise<Task[]> {
    console.log("[TaskService] Getting all active 'once' tasks");
    return this.taskRepo.getAllActiveOnceTasks(userId);
  }
}

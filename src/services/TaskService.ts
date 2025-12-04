import { Transaction } from 'react-native-nitro-sqlite';
import { db } from '../db';
import {
  TaskRepository,
  RepetitiveTaskTemplateRepository,
  PendingOperationRepository,
} from '../db/repository';
import { getNextIterationDateForRepetitiveTask } from '../shared/utils';

import type { NewTaskData, Task } from '../types';
import { TaskCompletionStatusEnum, TaskScheduleTypeEnum } from '../types';
import { eventManager } from './EventManager';
import { SYNC_TRIGGER_REQUESTED } from '../shared/constants';
import dayjs from 'dayjs';

export class TaskService {
  private taskRepo: TaskRepository;
  private pendingOpRepo: PendingOperationRepository;
  private rttRepo: RepetitiveTaskTemplateRepository;

  constructor() {
    this.taskRepo = new TaskRepository(db);
    this.pendingOpRepo = new PendingOperationRepository(db);
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
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
   * Internal method to create a task and enqueue a sync operation.
   * This method does NOT manage transactions; the caller is responsible for that.
   * @param taskData The data for the new task.
   * @param userId The userId of the user.
   * @returns The newly created task.
   */
  async _createTaskInternal(
    taskData: NewTaskData,
    userId: string | null,
    tx: Transaction,
  ): Promise<Task> {
    const newTask = await this.taskRepo.createTask(taskData, userId, tx);

    if (userId) {
      console.log(
        '[TaskService] Logged-in user. Enqueuing pending operation for new task.',
      );
      await this.pendingOpRepo.enqueueOperation(
        {
          userId: userId,
          operation_type: 'create',
          entity_type: 'task',
          entity_id: newTask.id,
          payload: JSON.stringify({ ...newTask, tags: [] }),
        },
        tx,
      );
    }
    return newTask;
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
    let newTask: Task | undefined;
    await db.transaction(async tx => {
      newTask = await this._createTaskInternal(taskData, userId, tx);
    });

    if (!newTask) {
      throw new Error('Task creation failed within transaction.');
    }

    if (userId) {
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
    }

    return newTask.id;
  }

  async updateTask(
    taskId: string,
    taskData: NewTaskData,
    userId: string | null,
  ): Promise<void> {
    await db.transaction(async tx => {
      const updatedTask = await this.taskRepo.updateTaskById(
        taskId,
        taskData,
        userId,
        tx,
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

        await this.pendingOpRepo.enqueueOperation(
          {
            operation_type: 'update',
            entity_type: 'task',
            entity_id: taskId,
            payload: JSON.stringify(remoteTaskPayload),
            userId,
          },
          tx,
        );
      }
    });

    if (userId) {
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
    }
  }

  async bulkFailTasks(taskIds: string[], userId: string | null): Promise<void> {
    if (taskIds.length === 0) {
      console.log('[TaskService] bulkFailTasks called with no task IDs.');
      return;
    }

    await db.transaction(async tx => {
      const updatedTasks = await this.taskRepo.bulkFailTasks(
        taskIds,
        userId,
        tx,
      );

      if (userId && updatedTasks.length > 0) {
        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operations for bulk fail.',
        );
        const opPromises = updatedTasks.map(task => {
          const remoteTaskPayload = { ...task, tags: [] };
          return this.pendingOpRepo.enqueueOperation(
            {
              operation_type: 'update',
              entity_type: 'task',
              entity_id: task.id,
              payload: JSON.stringify(remoteTaskPayload),
              userId,
            },
            tx,
          );
        });
        await Promise.all(opPromises);
      }
    });

    if (userId) {
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
    }
  }

  async failAllOverdueTasksAtOnce(userId: string | null): Promise<void> {
    await db.transaction(async tx => {
      const failedTasks = await this.taskRepo.failAllOverdueTasksAtOnce(
        userId,
        tx,
      );

      if (userId && failedTasks.length > 0) {
        console.log(
          '[TaskService] Logged-in user. Enqueuing pending operations for all overdue tasks.',
        );
        const opPromises = failedTasks.map(task => {
          const remoteTaskPayload = { ...task, tags: [] };
          return this.pendingOpRepo.enqueueOperation(
            {
              operation_type: 'update',
              entity_type: 'task',
              entity_id: task.id,
              payload: JSON.stringify(remoteTaskPayload),
              userId,
            },
            tx,
          );
        });
        await Promise.all(opPromises);
      }
    });

    if (userId) {
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
    }
  }
  async updateTaskCompletionStatus(
    taskId: string,
    status: TaskCompletionStatusEnum,
    userId: string | null,
    score?: number | null,
  ): Promise<void> {
    await db.transaction(async tx => {
      const updatedTask = await this.taskRepo.updateTaskCompletionStatus(
        taskId,
        status,
        userId,
        score,
        tx,
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

        await this.pendingOpRepo.enqueueOperation(
          {
            operation_type: 'update',
            entity_type: 'task',
            entity_id: taskId,
            payload: JSON.stringify(remoteTaskPayload),
            userId,
          },
          tx,
        );
      }
    });
    if (userId) {
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
    }
  }
  async updateTaskDueDate(
    taskId: string,
    dueDate: Date,
    userId: string | null,
  ): Promise<void> {
    const task = await this.getTaskById(taskId, userId);
    if (!task) {
      throw new Error(
        `[TaskService] Cannot update due date for non-existent or unauthorized task with ID ${taskId}`,
      );
    }

    if (task.schedule === TaskScheduleTypeEnum.Daily) {
      throw new Error('[TaskService] Cannot update due date for a daily tasks');
    }

    if (
      task.schedule === TaskScheduleTypeEnum.SpecificDaysInAWeek &&
      task.repetitiveTaskTemplateId
    ) {
      const repetitiveTaskTemplate =
        await this.rttRepo.getRepetitiveTaskTemplateById(
          task.repetitiveTaskTemplateId,
          userId,
        );

      if (!repetitiveTaskTemplate) {
        throw new Error(
          `[TaskService] Cannot update due date for a repetitive task with non-existent or unauthorized repetitive task template with ID ${task.repetitiveTaskTemplateId}`,
        );
      }

      const nextIterationDate = getNextIterationDateForRepetitiveTask(
        repetitiveTaskTemplate,
        dayjs(task.dueDate),
      );

      if (!nextIterationDate) {
        throw new Error(
          `[TaskService] Cannot update due date for a repetitive task with non-existent or unauthorized repetitive task template with ID ${task.repetitiveTaskTemplateId}`,
        );
      }

      if (!dayjs(dueDate).isBefore(nextIterationDate)) {
        throw new Error(
          '[TaskService] Cannot update due date for a repetitive task to a date that is not before the next iteration date',
        );
      }
    }

    await db.transaction(async tx => {
      const updatedTask = await this.taskRepo.updateTaskDueDate(
        taskId,
        dueDate,
        userId,
        tx,
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

        await this.pendingOpRepo.enqueueOperation(
          {
            operation_type: 'update',
            entity_type: 'task',
            entity_id: taskId,
            payload: JSON.stringify(remoteTaskPayload),
            userId,
          },
          tx,
        );
      }
    });
    if (userId) {
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
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

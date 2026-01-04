import { db } from '../db';
import {
  TaskRepository,
  SpaceRepository,
  RepetitiveTaskTemplateRepository,
  PendingOperationRepository,
} from '../db/repository';
import { eventManager } from './EventManager';
import { SYNC_TRIGGER_REQUESTED } from '../shared/constants';

class DataMigrationService {
  private taskRepo: TaskRepository;
  private spaceRepo: SpaceRepository;
  private rttRepo: RepetitiveTaskTemplateRepository;
  private pendingOpRepo: PendingOperationRepository;

  constructor() {
    this.taskRepo = new TaskRepository(db);
    this.spaceRepo = new SpaceRepository(db);
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
    this.pendingOpRepo = new PendingOperationRepository(db);
  }

  async hasAnonymousData(): Promise<boolean> {
    try {
      const [hasTasks, hasSpaces, hasTemplates] = await Promise.all([
        this.taskRepo.hasAnonymousData(),
        this.spaceRepo.hasAnonymousData(),
        this.rttRepo.hasAnonymousData(),
      ]);

      return hasTasks || hasSpaces || hasTemplates;
    } catch (error) {
      console.error(
        '[DataMigrationService] Failed to check anonymous data:',
        error,
      );
      return false;
    }
  }

  async assignAnonymousDataToUser(userId: string): Promise<void> {
    console.log(
      `[DataMigrationService] Starting migration of anonymous data to user: ${userId}`,
    );
    try {
      await db.transaction(async tx => {
        await this.taskRepo.assignAnonymousTasksToUser(userId, tx);
        await this.spaceRepo.assignAnonymousSpacesToUser(userId, tx);
        await this.rttRepo.assignAnonymousTemplatesToUser(userId, tx);
      });
      console.log('[DataMigrationService] Migration successful.');
    } catch (error) {
      console.error(
        '[DataMigrationService] Failed to assign anonymous data:',
        error,
      );
      throw error;
    }
  }

  async queueAllDataForSync(userId: string): Promise<void> {
    console.log(
      `[DataMigrationService] Queuing all data for sync for user: ${userId}`,
    );
    const BATCH_SIZE = 100;

    try {
      await db.transaction(async tx => {
        let offset = 0;
        while (true) {
          const spaces = await this.spaceRepo.getSpacesForSyncBootstrap(
            userId,
            BATCH_SIZE,
            offset,
          );
          if (spaces.length === 0) {
            break;
          }

          for (const space of spaces) {
            await this.pendingOpRepo.enqueueOperation(
              {
                userId,
                operation_type: 'create',
                entity_type: 'space',
                entity_id: space.id,
                payload: JSON.stringify(space),
              },
              tx,
            );
          }
          offset += BATCH_SIZE;
        }

        offset = 0;
        while (true) {
          const repetitiveTaskTemplates =
            await this.rttRepo.getRepetitiveTaskTemplatesForSyncBootstrap(
              userId,
              BATCH_SIZE,
              offset,
            );
          if (repetitiveTaskTemplates.length === 0) {
            break;
          }

          for (const template of repetitiveTaskTemplates) {
            await this.pendingOpRepo.enqueueOperation(
              {
                userId,
                operation_type: 'create',
                entity_type: 'repetitive_task_template',
                entity_id: template.id,
                payload: JSON.stringify({ ...template, tags: [] }),
              },
              tx,
            );
          }
          offset += BATCH_SIZE;
        }

        offset = 0;
        while (true) {
          const tasks = await this.taskRepo.getTasksForSyncBootstrap(
            userId,
            BATCH_SIZE,
            offset,
          );
          if (tasks.length === 0) {
            break;
          }

          for (const task of tasks) {
            await this.pendingOpRepo.enqueueOperation(
              {
                userId,
                operation_type: 'create',
                entity_type: 'task',
                entity_id: task.id,
                payload: JSON.stringify({ ...task, tags: [] }),
              },
              tx,
            );
          }
          offset += BATCH_SIZE;
        }
      });

      console.log('[DataMigrationService] All data queued for sync.');
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
    } catch (error) {
      console.error(
        '[DataMigrationService] Failed to queue data for sync:',
        error,
      );
      throw error;
    }
  }
}

export const dataMigrationService = new DataMigrationService();

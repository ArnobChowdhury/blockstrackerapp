import { db } from '../db';
import {
  TaskRepository,
  SpaceRepository,
  RepetitiveTaskTemplateRepository,
} from '../db/repository';

class DataMigrationService {
  private taskRepo: TaskRepository;
  private spaceRepo: SpaceRepository;
  private rttRepo: RepetitiveTaskTemplateRepository;

  constructor() {
    this.taskRepo = new TaskRepository(db);
    this.spaceRepo = new SpaceRepository(db);
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
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
}

export const dataMigrationService = new DataMigrationService();

import { db } from '../db';
import { SpaceRepository, PendingOperationRepository } from '../db/repository';
import type { Space } from '../types';
import { syncService } from './SyncService';

export class SpaceService {
  private spaceRepo: SpaceRepository;
  private pendingOpRepo: PendingOperationRepository;

  constructor() {
    this.spaceRepo = new SpaceRepository(db);
    this.pendingOpRepo = new PendingOperationRepository(db);
  }

  async getAllSpaces(userId: string | null): Promise<Space[]> {
    return this.spaceRepo.getAllSpaces(userId);
  }

  async getSpaceById(id: string, userId: string | null): Promise<Space | null> {
    return this.spaceRepo.getSpaceById(id, userId);
  }

  async createSpace(name: string, userId: string | null): Promise<string> {
    let newId: string;
    let newSpace: Space;
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      newSpace = await this.spaceRepo.createSpace(name, userId);
      newId = newSpace.id;

      if (userId) {
        console.log(
          '[SpaceService] Logged-in user. Enqueuing pending operation.',
        );

        await this.pendingOpRepo.enqueueOperation({
          userId: userId,
          operation_type: 'create',
          entity_type: 'space',
          entity_id: newId,
          payload: JSON.stringify(newSpace),
        });
      } else {
        console.log(
          '[SpaceService] Anonymous user. Skipping pending operation.',
        );
      }

      await db.executeAsync('COMMIT;');
      console.log(
        `[SpaceService] Transaction for creating space ${newId} committed successfully.`,
      );

      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        '[SpaceService] Transaction for creating space failed. Rolling back.',
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
    return newId;
  }
}

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

  async getAllSpaces(): Promise<Space[]> {
    return this.spaceRepo.getAllSpaces();
  }

  async getSpaceById(id: string): Promise<Space | null> {
    return this.spaceRepo.getSpaceById(id);
  }

  async createSpace(name: string, userId: string | null): Promise<string> {
    let newId: string;
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      newId = await this.spaceRepo.createSpace(name, userId);

      if (userId) {
        console.log(
          '[SpaceService] Logged-in user. Enqueuing pending operation.',
        );
        const now = new Date();
        const remotePayload = {
          id: newId,
          name: name,
          createdAt: now.toISOString(),
          modifiedAt: now.toISOString(),
        };

        await this.pendingOpRepo.enqueueOperation({
          userId: userId,
          operation_type: 'create',
          entity_type: 'space',
          entity_id: newId,
          payload: JSON.stringify(remotePayload),
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

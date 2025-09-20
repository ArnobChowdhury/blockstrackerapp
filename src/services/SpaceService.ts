import { db } from '../db';
import { SpaceRepository, PendingOperationRepository } from '../db/repository';
import type { Space } from '../types';
import uuid from 'react-native-uuid';
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

  async createSpace(name: string, isLoggedIn: boolean): Promise<string> {
    if (!isLoggedIn) {
      console.log('[SpaceService] Offline user. Writing to local DB only.');
      return await this.spaceRepo.createSpace(name);
    }

    console.log('[SpaceService] Logged-in user. Using transactional outbox.');

    const now = new Date();
    const newId = uuid.v4() as string;

    const remotePayload = {
      id: newId,
      name: name,
      createdAt: now.toISOString(),
      modifiedAt: now.toISOString(),
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      await this.spaceRepo._internalAddSpace(newId, name);

      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'create',
        entity_type: 'space',
        entity_id: newId,
        payload: JSON.stringify(remotePayload),
      });

      await db.executeAsync('COMMIT;');
      console.log(
        `[SpaceService] Transaction for creating space ${newId} committed.`,
      );

      syncService.runSync();

      return newId;
    } catch (error) {
      console.error(
        `[SpaceService] Transaction for creating space ${newId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }
}

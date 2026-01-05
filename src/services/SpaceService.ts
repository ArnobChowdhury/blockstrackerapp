import { db } from '../db';
import { SpaceRepository, PendingOperationRepository } from '../db/repository';
import type { Space } from '../types';
import { eventManager } from './EventManager';
import {
  SYNC_TRIGGER_REQUESTED,
  WRITE_OPERATION_COMPLETED,
} from '../shared/constants';

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

  async createSpace(
    name: string,
    userId: string | null,
    isPremium: boolean,
  ): Promise<string> {
    let createdSpace: Space | undefined;
    await db.transaction(async tx => {
      createdSpace = await this.spaceRepo.createSpace(name, userId, tx);

      if (userId && isPremium) {
        console.log(
          '[SpaceService] Logged-in user. Enqueuing pending operation.',
        );
        await this.pendingOpRepo.enqueueOperation(
          {
            userId: userId,
            operation_type: 'create',
            entity_type: 'space',
            entity_id: createdSpace.id,
            payload: JSON.stringify(createdSpace),
          },
          tx,
        );
      }
    });

    if (!createdSpace) {
      throw new Error('Space creation failed within transaction.');
    }

    if (userId && isPremium) {
      eventManager.emit(SYNC_TRIGGER_REQUESTED);
    }

    eventManager.emit(WRITE_OPERATION_COMPLETED);

    return createdSpace.id;
  }
}

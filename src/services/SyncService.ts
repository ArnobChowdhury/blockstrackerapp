import axios from 'axios';
import apiClient, { CustomAxiosError } from '../lib/apiClient';
import { db } from '../db';
import {
  PendingOperationRepository,
  PendingOperation,
} from '../db/repository/PendingOperationRepository';
import {
  SettingsRepository,
  TaskRepository,
  SpaceRepository,
  RepetitiveTaskTemplateRepository,
} from '../db/repository';
import { apiEndpoints } from '../config/apiRoutes';

let isSyncing = false;

class SyncService {
  private pendingOpRepo: PendingOperationRepository;
  private settingsRepo: SettingsRepository;
  private taskRepo: TaskRepository;
  private spaceRepo: SpaceRepository;
  // private tagRepo: TagRepository;
  private rttRepo: RepetitiveTaskTemplateRepository;

  constructor() {
    this.pendingOpRepo = new PendingOperationRepository(db);
    this.settingsRepo = new SettingsRepository(db);
    this.taskRepo = new TaskRepository(db);
    this.spaceRepo = new SpaceRepository(db);
    // this.tagRepo = new TagRepository(db);
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
  }

  public async runSync(): Promise<void> {
    if (isSyncing) {
      console.log('[SyncService] Sync process already running. Exiting.');
      return;
    }

    console.log('[SyncService] Starting sync process...');
    isSyncing = true;

    const processedInCurrentRun: number[] = [];

    try {
      while (true) {
        console.log('[SyncService] Starting PUSH phase...');

        while (true) {
          const operation = await this.pendingOpRepo.getOldestPendingOperation(
            processedInCurrentRun,
          );

          if (!operation) {
            console.log(
              '[SyncService] Local queue is empty of new operations. PUSH phase complete.',
            );
            break;
          }

          console.log(`[SyncService] Processing operation ID: ${operation.id}`);
          processedInCurrentRun.push(operation.id);
          await this.processOperation(operation);
        }

        console.log('[SyncService] Starting PULL phase...');
        await this.pullRemoteChanges();

        const newOperationCheck =
          await this.pendingOpRepo.getOldestPendingOperation(
            processedInCurrentRun,
          );

        if (!newOperationCheck) {
          console.log('[SyncService] System is stable. Finishing sync cycle.');
          break;
        } else {
          console.log(
            '[SyncService] New operations found after PULL. Looping to restart PUSH phase.',
          );
        }
      }
    } catch (error) {
      console.error(
        '[SyncService] An unexpected error occurred in runSync:',
        error,
      );
    } finally {
      isSyncing = false;
      console.log('[SyncService] Sync process finished.');
    }
  }

  private async processOperation(operation: PendingOperation): Promise<void> {
    const { id, entity_type, operation_type, entity_id, payload } = operation;

    const endpointConfig = apiEndpoints[entity_type]?.[operation_type];

    if (!endpointConfig) {
      console.error(
        `[SyncService] No API endpoint configured for ${entity_type} -> ${operation_type}. Marking as failed.`,
      );
      await this.pendingOpRepo.updateOperationStatus(id, 'failed');
      return;
    }

    const url = endpointConfig.path.replace(':id', entity_id);

    const data =
      endpointConfig.method === 'POST' || endpointConfig.method === 'PUT'
        ? JSON.parse(payload)
        : undefined;

    try {
      await this.pendingOpRepo.updateOperationStatus(
        id,
        'processing',
        undefined,
      );
      await apiClient({
        method: endpointConfig.method,
        url,
        data,
      });

      console.log(
        `[SyncService] Operation ${id} synced successfully. Deleting from queue.`,
      );
      await this.pendingOpRepo.deleteOperation(id, undefined);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        await this.handleAxiosError(error, operation);
      } else {
        console.warn(
          `[SyncService] An unexpected network error occurred for operation ${id}. Recording failed attempt.`,
          error,
        );
        await this.pendingOpRepo.recordFailedAttempt(id, undefined);
      }
    }
  }

  private async pullRemoteChanges(): Promise<void> {
    while (true) {
      let syncData;
      let lastChangeId;
      try {
        lastChangeId = await this.settingsRepo.getLastChangeId();
        console.log(
          `[SyncService] Fetching changes since change ID: ${lastChangeId}`,
        );

        const endpoint = apiEndpoints.sync!.fetch!;
        const response = await apiClient.get(endpoint.path, {
          params: { last_change_id: lastChangeId },
        });
        syncData = response.data.result.data;
      } catch (error) {
        console.error(
          '[SyncService] Failed to fetch remote changes from API:',
          error,
        );
        break;
      }

      const hasNewChanges =
        syncData.tasks?.length > 0 ||
        syncData.spaces?.length > 0 ||
        syncData.repetitiveTaskTemplates?.length > 0;

      if (!hasNewChanges) {
        await this.settingsRepo.setLastChangeId(syncData.latestChangeId);
        break;
      }

      try {
        console.log(
          '[SyncService] Beginning database transaction for sync pull.',
        );
        await db.transaction(async tx => {
          if (syncData.spaces?.length > 0) {
            await this.spaceRepo.upsertMany(syncData.spaces, tx);
          }
          if (syncData.repetitiveTaskTemplates?.length > 0) {
            await this.rttRepo.upsertMany(syncData.repetitiveTaskTemplates, tx);
          }
          if (syncData.tasks?.length > 0) {
            await this.taskRepo.upsertMany(syncData.tasks, tx);
          }
          // ... other repositories

          await this.settingsRepo.setLastChangeId(syncData.latestChangeId, tx);
        });
      } catch (error) {
        console.error(
          '[SyncService] Error during sync pull transaction. Rolling back.',
          error,
        );
        break;
      }
    }
  }

  private async handleAxiosError(
    error: CustomAxiosError,
    operation: PendingOperation,
  ) {
    const { id, entity_type: entityType, entity_id: entityId } = operation;

    if (error.response) {
      const { status, data } = error.response;
      const errorCode = data?.result?.code;

      if (status === 409) {
        await db.transaction(async tx => {
          if (errorCode === 'DUPLICATE_ENTITY') {
            const canonicalId = data?.result?.data?.canonical_id;
            if (canonicalId) {
              console.warn(
                `[SyncService] Duplicate entity conflict for operation ${id} (entityId: ${entityId}). Canonical ID: ${canonicalId}. Remapping and deleting local entity.`,
              );
              await this.pendingOpRepo.remapEntityId(entityId, canonicalId, tx);

              switch (entityType) {
                case 'task':
                  await this.taskRepo.deleteTaskById(entityId, tx);
                  break;
              }
              await this.pendingOpRepo.deleteOperation(id, tx);
            } else {
              console.error(
                `[SyncService] DUPLICATE_ENTITY conflict for operation ${id} but no canonical_id provided. Marking as failed.`,
                data,
              );
              await this.pendingOpRepo.updateOperationStatus(id, 'failed', tx);
            }
          } else if (errorCode === 'STALE_DATA') {
            console.warn(
              `[SyncService] Stale data conflict for operation ${id}. Deleting operation.`,
            );
            await this.pendingOpRepo.deleteOperation(id, tx);
          } else {
            console.error(
              `[SyncService] Unknown 409 conflict for operation ${id}. Marking as failed.`,
              data,
            );
            await this.pendingOpRepo.updateOperationStatus(id, 'failed', tx);
          }
        });
      } else if (status === 404) {
        console.warn(
          `[SyncService] Entity not found (404) for operation ${id}. Deleting operation.`,
        );
        await this.pendingOpRepo.deleteOperation(id, undefined);
      } else if (status === 401) {
        console.warn(
          `[SyncService] Unauthorized (401) for operation ${id}. Recording failed attempt.`,
        );
        await this.pendingOpRepo.recordFailedAttempt(id, undefined);
      } else if (status >= 500) {
        console.warn(
          `[SyncService] Server error (${status}) for operation ${id}. Recording failed attempt.`,
        );
        await this.pendingOpRepo.recordFailedAttempt(id, undefined);
      } else if (status >= 400) {
        // Other 4xx errors (400, 422, etc.)
        console.error(
          `[SyncService] Client error (${status}) for operation ${id}. Marking as failed.`,
          error.response.data,
        );
        await this.pendingOpRepo.updateOperationStatus(id, 'failed', undefined);
      }
    } else if (error.request) {
      // Network error (no response received)
      console.warn(
        `[SyncService] No response received (network error) for operation ${id}. Recording failed attempt.`,
      );
      await this.pendingOpRepo.recordFailedAttempt(id, undefined);
    }
  }
}

export const syncService = new SyncService();

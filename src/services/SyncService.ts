import axios, { AxiosError } from 'axios';
import apiClient from '../lib/apiClient';
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
  private onSyncStatusChange: ((isSyncing: boolean) => void) | null = null;

  constructor() {
    this.pendingOpRepo = new PendingOperationRepository(db);
    this.settingsRepo = new SettingsRepository(db);
    this.taskRepo = new TaskRepository(db);
    this.spaceRepo = new SpaceRepository(db);
    // this.tagRepo = new TagRepository(db);
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
  }

  public initialize(callbacks: {
    onSyncStatusChange: (isSyncing: boolean) => void;
  }) {
    this.onSyncStatusChange = callbacks.onSyncStatusChange;
  }

  public async runSync(): Promise<void> {
    if (isSyncing) {
      console.log('[SyncService] Sync process already running. Exiting.');
      return;
    }

    console.log('[SyncService] Starting sync process...');
    isSyncing = true;
    this.onSyncStatusChange?.(true);

    try {
      console.log('[SyncService] Starting PUSH phase...');
      while (true) {
        const operation = await this.pendingOpRepo.getOldestPendingOperation();
        if (!operation) {
          console.log(
            '[SyncService] Local queue is empty. PUSH phase complete.',
          );
          break;
        }
        await this.processOperation(operation);
      }

      console.log('[SyncService] Starting PULL phase...');
      await this.pullRemoteChanges();
    } catch (error) {
      console.error(
        '[SyncService] An unexpected error occurred in runSync:',
        error,
      );
    } finally {
      isSyncing = false;
      this.onSyncStatusChange?.(false);
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

    console.log(
      `[SyncService] Making API call: ${endpointConfig.method} ${url}`,
    );

    try {
      await this.pendingOpRepo.updateOperationStatus(id, 'processing');
      await apiClient({
        method: endpointConfig.method,
        url,
        data,
      });

      console.log(
        `[SyncService] Operation ${id} synced successfully. Deleting from queue.`,
      );
      await this.pendingOpRepo.deleteOperation(id);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        await this.handleAxiosError(error, id);
      } else {
        console.warn(
          `[SyncService] An unexpected network error occurred for operation ${id}. Recording failed attempt.`,
          error,
        );
        await this.pendingOpRepo.recordFailedAttempt(id);
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
        await db.executeAsync('BEGIN TRANSACTION;');

        if (syncData.spaces?.length > 0) {
          await this.spaceRepo.upsertMany(syncData.spaces);
        }
        if (syncData.repetitiveTaskTemplates?.length > 0) {
          await this.rttRepo.upsertMany(syncData.repetitiveTaskTemplates);
        }
        if (syncData.tasks?.length > 0) {
          await this.taskRepo.upsertMany(syncData.tasks);
        }
        // ... other repositories

        await this.settingsRepo.setLastChangeId(syncData.latestChangeId);

        await db.executeAsync('COMMIT;');
        console.log(
          `[SyncService] PULL phase complete. Transaction committed. Synced up to change ID: ${syncData.latestChangeId}`,
        );
      } catch (error) {
        console.error(
          '[SyncService] Error during sync pull transaction. Rolling back.',
          error,
        );
        await db.executeAsync('ROLLBACK;');
        break;
      }
    }
  }

  private async handleAxiosError(error: AxiosError, operationId: number) {
    if (error.response) {
      const { status } = error.response;

      if (status >= 500) {
        console.warn(
          `[SyncService] Server error (${status}) for operation ${operationId}. Recording failed attempt.`,
        );
        await this.pendingOpRepo.recordFailedAttempt(operationId);
      } else if (status >= 400) {
        console.error(
          `[SyncService] Client error (${status}) for operation ${operationId}. Marking as failed.`,
          error.response.data,
        );
        await this.pendingOpRepo.updateOperationStatus(operationId, 'failed');
      }
    } else if (error.request) {
      console.warn(
        `[SyncService] No response received for operation ${operationId}. Recording failed attempt.`,
      );
      await this.pendingOpRepo.recordFailedAttempt(operationId);
    }
  }
}

export const syncService = new SyncService();

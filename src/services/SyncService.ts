import axios, { AxiosError } from 'axios';
import apiClient from '../lib/apiClient';
import { db } from '../db';
import {
  PendingOperationRepository,
  PendingOperation,
} from '../db/repository/PendingOperationRepository';
import { apiEndpoints } from '../config/apiRoutes';

let isSyncing = false;

export class SyncService {
  private pendingOpRepo: PendingOperationRepository;

  constructor() {
    this.pendingOpRepo = new PendingOperationRepository(db);
  }

  public async runSync(): Promise<void> {
    if (isSyncing) {
      console.log('[SyncService] Sync process already running. Exiting.');
      return;
    }

    console.log('[SyncService] Starting sync process...');
    isSyncing = true;

    try {
      while (true) {
        const operation = await this.pendingOpRepo.getOldestPendingOperation();

        if (!operation) {
          console.log(
            '[SyncService] Queue is empty or blocked. Halting sync cycle.',
          );
          break;
        }

        console.log('[SyncService] Processing operation:', operation);

        await this.pendingOpRepo.updateOperationStatus(
          operation.id,
          'processing',
        );

        await this.processOperation(operation);
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

    console.log(
      `[SyncService] Making API call: ${endpointConfig.method} ${url}`,
    );

    try {
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

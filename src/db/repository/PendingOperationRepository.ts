import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';

export interface PendingOperation {
  id: number;
  operation_type: 'create' | 'update';
  entity_type: 'task' | 'space' | 'tag' | 'repetitive_task_template';
  entity_id: string;
  payload: string;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  created_at: string;
}
export interface PendingOperationData {
  userId: string;
  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'task' | 'space' | 'tag' | 'repetitive_task_template';
  entity_id: string;
  payload: string;
}

export class PendingOperationRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async enqueueOperation(opData: PendingOperationData): Promise<QueryResult> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO pending_operations (
        operation_type, entity_type, entity_id, payload, created_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?);
    `;
    const params = [
      opData.operation_type,
      opData.entity_type,
      opData.entity_id,
      opData.payload,
      now,
      opData.userId,
    ];

    console.log('[DB Repo] Enqueuing pending operation:', { sql, params });

    try {
      return await this.db.executeAsync(sql, params);
    } catch (error: any) {
      console.error('[DB Repo] Failed to enqueue operation:', error);
      throw new Error(
        `Failed to enqueue operation: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Retrieves the single oldest pending operation from the queue.
   * @returns The pending operation object or null if the queue is empty.
   */
  async getOldestPendingOperation(): Promise<PendingOperation | null> {
    const sql = `
      SELECT *
      FROM pending_operations po1
      WHERE
        po1.status = 'pending' AND
        NOT EXISTS (
          SELECT 1
          FROM pending_operations po2
          WHERE
            po2.entity_id = po1.entity_id AND
            po2.status IN ('processing', 'failed')
        )
      ORDER BY po1.id ASC
      LIMIT 1;
    `;

    try {
      const result = await this.db.executeAsync(sql);
      if (result.rows && result.rows.length > 0) {
        return result.rows.item(0) as unknown as PendingOperation;
      }
      return null;
    } catch (error: any) {
      console.error('[DB Repo] Failed to get oldest pending operation:', error);
      throw new Error(
        `Failed to get operation: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Updates the status of a specific pending operation.
   * @param operationId The ID of the operation to update.
   * @param status The new status to set.
   */
  async updateOperationStatus(
    operationId: number,
    status: 'processing' | 'failed',
  ): Promise<QueryResult> {
    const sql = 'UPDATE pending_operations SET status = ? WHERE id = ?;';
    const params = [status, operationId];

    console.log('[DB Repo] Updating operation status:', { sql, params });

    try {
      return await this.db.executeAsync(sql, params);
    } catch (error: any) {
      console.error('[DB Repo] Failed to update operation status:', error);
      throw new Error(
        `Failed to update status: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Deletes a pending operation from the queue, typically after a successful sync.
   * @param operationId The ID of the operation to delete.
   */
  async deleteOperation(operationId: number): Promise<QueryResult> {
    const sql = 'DELETE FROM pending_operations WHERE id = ?;';
    const params = [operationId];

    console.log('[DB Repo] Deleting operation:', { sql, params });

    try {
      return await this.db.executeAsync(sql, params);
    } catch (error: any) {
      console.error('[DB Repo] Failed to delete operation:', error);
      throw new Error(
        `Failed to delete operation: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Handles a transient failure by incrementing the attempt count and
   * resetting the status to 'pending' for a future retry.
   * @param operationId The ID of the operation that failed.
   */
  async recordFailedAttempt(operationId: number): Promise<QueryResult> {
    const sql = `
      UPDATE pending_operations
      SET
        attempts = attempts + 1,
        status = 'pending'
      WHERE id = ?;
    `;
    const params = [operationId];

    console.log('[DB Repo] Recording failed attempt for operation:', {
      sql,
      params,
    });

    try {
      return await this.db.executeAsync(sql, params);
    } catch (error: any) {
      console.error('[DB Repo] Failed to record failed attempt:', error);
      throw new Error(
        `Failed to record failed attempt: ${error.message || 'Unknown error'}`,
      );
    }
  }
}

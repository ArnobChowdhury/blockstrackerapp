import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';

export interface PendingOperationData {
  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'task' | 'space' | 'tag' | 'repetitive_task_template';
  entity_id: string;
  payload: string; // JSON string
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
        operation_type, entity_type, entity_id, payload, created_at
      ) VALUES (?, ?, ?, ?, ?);
    `;
    const params = [
      opData.operation_type,
      opData.entity_type,
      opData.entity_id,
      opData.payload,
      now,
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
}

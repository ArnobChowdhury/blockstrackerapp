import {
  type NitroSQLiteConnection,
  type QueryResult,
  type Transaction,
} from 'react-native-nitro-sqlite';

const LAST_CHANGE_ID_KEY = 'last_change_id';
const LAST_SYNC_TIMESTAMP_KEY = 'last_sync_timestamp';

export class SettingsRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async getLastChangeId(userId: string): Promise<number> {
    const sql = 'SELECT value FROM settings WHERE key = ? AND user_id = ?';
    const params = [LAST_CHANGE_ID_KEY, userId];

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        if (row && typeof row.value === 'string') {
          const parsedValue = parseInt(row.value, 10);
          return isNaN(parsedValue) ? 0 : parsedValue;
        }
      }
      return 0; // Default to 0 if not found
    } catch (error: any) {
      console.error('[DB Repo] Failed to get last_change_id:', error);
      throw new Error(
        `Failed to get last_change_id: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async setLastChangeId(
    id: number,
    userId: string,
    tx?: Transaction,
  ): Promise<void> {
    const sql = `
      INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value;
    `;
    const params = [userId, LAST_CHANGE_ID_KEY, id.toString()];

    try {
      const dbOrTx = tx || this.db;
      await dbOrTx.executeAsync(sql, params);
      console.log(`[DB Repo] Updated last_change_id to ${id}`);
    } catch (error: any) {
      console.error('[DB Repo] Failed to set last_change_id:', error);
      throw new Error(
        `Failed to set last_change_id: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Retrieves the timestamp of the last successful sync.
   * @returns The timestamp in milliseconds since epoch, or 0 if not found.
   */
  async getLastSync(userId: string): Promise<number> {
    const sql = 'SELECT value FROM settings WHERE key = ? AND user_id = ?';
    const params = [LAST_SYNC_TIMESTAMP_KEY, userId];

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        if (row && typeof row.value === 'string') {
          const parsedValue = parseInt(row.value, 10);
          return isNaN(parsedValue) ? 0 : parsedValue;
        }
      }
      return 0; // Default to 0 if not found
    } catch (error: any) {
      console.error('[DB Repo] Failed to get last_sync_timestamp:', error);
      throw new Error(
        `Failed to get last_sync_timestamp: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Stores the timestamp of the last successful sync.
   * @param timestamp The timestamp in milliseconds since epoch.
   * @param tx Optional transaction object.
   */
  async setLastSync(
    timestamp: number,
    userId: string,
    tx?: Transaction,
  ): Promise<void> {
    const sql = `
      INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value;
    `;
    const params = [userId, LAST_SYNC_TIMESTAMP_KEY, timestamp.toString()];

    const dbOrTx = tx || this.db;
    await dbOrTx.executeAsync(sql, params);
    console.log(`[DB Repo] Updated last_sync_timestamp to ${timestamp}`);
  }
}

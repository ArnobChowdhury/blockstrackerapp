import {
  type NitroSQLiteConnection,
  type QueryResult,
  type Transaction,
} from 'react-native-nitro-sqlite';

const LAST_CHANGE_ID_KEY = 'last_change_id';

export class SettingsRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async getLastChangeId(): Promise<number> {
    const sql = 'SELECT value FROM settings WHERE key = ?';
    const params = [LAST_CHANGE_ID_KEY];

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

  async setLastChangeId(id: number, tx?: Transaction): Promise<void> {
    const sql = `
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `;
    const params = [LAST_CHANGE_ID_KEY, id.toString()];

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
}

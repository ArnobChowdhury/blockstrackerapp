import { NitroSQLiteConnection } from 'react-native-nitro-sqlite';

export interface User {
  id: string;
  email: string;
  isPremium: boolean;
  createdAt: string;
  modifiedAt: string;
  deletedAt: string | null;
}

export class UserRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async getUserById(
    userId: string,
  ): Promise<Pick<User, 'id' | 'email' | 'isPremium'> | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const params = [userId];
    try {
      const result = await this.db.executeAsync(sql, params);
      if (result.rows && result.rows.length > 0) {
        const row = result.rows.item(0);
        if (row) {
          return {
            id: row.id as string,
            email: row.email as string,
            isPremium: row.is_premium === 1,
          };
        }
      }
      return null;
    } catch (error: any) {
      console.error('[DB Repo] Failed to get user by id:', error);
      throw new Error(
        `Failed to get user by id: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Inserts a new user or updates an existing one based on the user ID.
   * @param user The user data to upsert.
   */
  async upsertUser(
    user: Pick<User, 'id' | 'email' | 'isPremium'>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO users (id, email, is_premium, created_at, modified_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        is_premium = excluded.is_premium,
        modified_at = excluded.modified_at;
    `;

    const params = [user.id, user.email, user.isPremium ? 1 : 0, now, now];

    console.log('[DB Repo] Attempting to UPSERT User:', { sql, params });

    try {
      await this.db.executeAsync(sql, params);
      console.log('[DB Repo] User UPSERT successful for id:', user.id);
    } catch (error: any) {
      console.error('[DB Repo] Failed to UPSERT user:', error);
      throw new Error(
        `Failed to save the user: ${error.message || 'Unknown error'}`,
      );
    }
  }
}

import { NitroSQLiteConnection } from 'react-native-nitro-sqlite';

export interface User {
  id: string;
  email: string;
  createdAt: string;
  modifiedAt: string;
  deletedAt: string | null;
}

export class UserRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  /**
   * Inserts a new user or updates an existing one based on the user ID.
   * @param user The user data to upsert.
   */
  async upsertUser(user: Pick<User, 'id' | 'email'>): Promise<void> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO users (id, email, created_at, modified_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        modified_at = excluded.modified_at;
    `;

    const params = [user.id, user.email, now, now];

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

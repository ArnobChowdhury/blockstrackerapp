import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';
import uuid from 'react-native-uuid';
import { Space } from '../../types';

export class SpaceRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  private _transformRowToSpace(row: any): Space {
    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string,
      modifiedAt: row.modified_at as string,
      userId: row.user_id as string | null,
    };
  }

  async getSpaceById(
    spaceId: string,
    userId: string | null,
  ): Promise<Space | null> {
    let sql = `
      SELECT id, name, created_at, modified_at, user_id FROM spaces WHERE id = ?
    `;
    const params: any[] = [spaceId];

    if (userId) {
      sql += ' AND user_id = ?;';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL;';
    }

    console.log('[DB Repo] Attempting to SELECT space by id:', {
      sql,
      params,
    });
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      if (resultSet.rows) {
        const space = resultSet.rows.item(0);
        if (space) {
          return this._transformRowToSpace(space);
        }
      }

      return null;
    } catch (error: any) {
      console.error('[DB Repo] Failed to SELECT space by id:', error);
      throw new Error(
        `Failed to retrieve space by id: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async getAllSpaces(userId: string | null): Promise<Space[]> {
    let sql = `
      SELECT id, name, created_at, modified_at, user_id FROM spaces
    `;
    const params: any[] = [];

    if (userId) {
      sql += ' WHERE user_id = ?;';
      params.push(userId);
    } else {
      sql += ' WHERE user_id IS NULL;';
    }

    console.log('[DB Repo] Attempting to SELECT all spaces:', { sql, params });
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      const spaces: Space[] = [];

      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const space = resultSet.rows.item(i);
          if (space) {
            spaces.push(this._transformRowToSpace(space));
          }
        }
      }

      return spaces;
    } catch (error: any) {
      console.error('[DB Repo] Failed to SELECT spaces:', error);
      throw new Error(
        `Failed to retrieve spaces: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async createSpace(name: string, userId: string | null): Promise<Space> {
    const newId = uuid.v4() as string;
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO spaces (
        id, name, created_at, modified_at, user_id
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING *;
    `;
    const params = [newId, name, now, now, userId];

    console.log('[DB Repo] Attempting to INSERT Space:', { sql, params });

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);

      console.log('[DB Repo] Space INSERT successful for id:', newId);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        return this._transformRowToSpace(row);
      }
      throw new Error('Failed to create space: no rows returned.');
    } catch (error: any) {
      console.error('[DB Repo] Failed to INSERT space:', error);
      throw new Error(
        `Failed to save the space: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async upsertMany(spaces: Space[]): Promise<void> {
    if (spaces.length === 0) {
      return;
    }

    console.log(
      `[DB Repo] UPSERTING ${spaces.length} spaces within a transaction.`,
    );

    const sql = `
      INSERT INTO spaces (
        id, name, created_at, modified_at, user_id
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        modified_at = excluded.modified_at
      WHERE excluded.modified_at >= spaces.modified_at;
    `;

    for (const space of spaces) {
      const params = [
        space.id,
        space.name,
        space.createdAt,
        space.modifiedAt,
        space.userId,
      ];
      await this.db.executeAsync(sql, params);
    }
  }
}

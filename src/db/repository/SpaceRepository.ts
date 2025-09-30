import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';
import uuid from 'react-native-uuid';
import { Space } from '../../types';

export class SpaceRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
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
          const transformedSpace: Space = {
            id: space.id as string,
            name: space.name as string,
            createdAt: space.created_at as string,
            modifiedAt: space.modified_at as string,
            userId: space.user_id as string | null,
          };

          return transformedSpace;
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
            const transformedSpace: Space = {
              id: space.id as string,
              name: space.name as string,
              createdAt: space.created_at as string,
              modifiedAt: space.modified_at as string,
              userId: space.user_id as string | null,
            };

            spaces.push(transformedSpace);
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
      ) VALUES (?, ?, ?, ?, ?);
    `;
    const params = [newId, name, now, now, userId];

    console.log('[DB Repo] Attempting to INSERT Space:', { sql, params });

    try {
      await this.db.executeAsync(sql, params);
      console.log('[DB Repo] Space INSERT successful for id:', newId);
      const newSpace = await this.getSpaceById(newId, userId);
      if (!newSpace) {
        throw new Error('Failed to fetch newly created space.');
      }
      return newSpace;
    } catch (error: any) {
      console.error('[DB Repo] Failed to INSERT space:', error);
      throw new Error(
        `Failed to save the space: ${error.message || 'Unknown error'}`,
      );
    }
  }
}

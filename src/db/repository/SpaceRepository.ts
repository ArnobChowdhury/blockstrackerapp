import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';
import uuid from 'react-native-uuid';
import { Space } from '../../types';

export class SpaceRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async getSpaceById(spaceId: string): Promise<Space | null> {
    const sql = `
      SELECT id, name, created_at, modified_at FROM spaces WHERE id = ?;
    `;

    console.log('[DB Repo] Attempting to SELECT space by id:', {
      sql,
      spaceId,
    });
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, [spaceId]);
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

  async getAllSpaces(): Promise<Space[]> {
    const sql = `
      SELECT id, name, created_at, modified_at FROM spaces;
    `;

    console.log('[DB Repo] Attempting to SELECT all spaces:', { sql });
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql);
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

  async addSpace(name: string): Promise<QueryResult> {
    const now = new Date().toISOString();
    const newId = uuid.v4() as string;
    const sql = `
      INSERT INTO spaces (
        id, name, created_at, modified_at
      ) VALUES (?, ?, ?, ?);
    `;

    const params = [newId, name, now, now];

    console.log('[DB Repo] Attempting to INSERT Space:', { sql, params });

    try {
      const result: QueryResult = await this.db.executeAsync(sql, params);
      console.log('[DB Repo] Space INSERT successful:', result);

      return result;
    } catch (error: any) {
      console.error('[DB Repo] Failed to INSERT space:', error);
      throw new Error(
        `Failed to save the space: ${error.message || 'Unknown error'}`,
      );
    }
  }
}

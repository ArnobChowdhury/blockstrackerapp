import type {NitroSQLiteConnection} from 'react-native-nitro-sqlite';
import {V1_SCHEMA} from './schema';

const LATEST_SCHEMA_VERSION = 1;

const MIGRATIONS: {[key: number]: string} = {
  1: V1_SCHEMA,
};

/**
 * Runs migrations to bring the database schema to the latest version.
 * @param db The QuickSQLiteConnection instance.
 */
export const runMigrations = async (
  db: NitroSQLiteConnection,
): Promise<void> => {
  try {
    console.log('[DB] Starting database migrations...');

    let currentVersionResult = db.execute('PRAGMA user_version;');

    console.log(
      '[DB] Current schema version result:',
      JSON.stringify(currentVersionResult),
    );
    let currentVersion = 0;

    const firstRow = currentVersionResult?.rows?.item(0);

    if (firstRow && typeof firstRow.user_version === 'number') {
      currentVersion = firstRow.user_version;
    } else {
      console.warn(
        '[DB] Could not reliably determine user_version from PRAGMA result:',
        JSON.stringify(currentVersionResult),
      );
    }

    console.log(
      `[DB] Current schema version: ${currentVersion}, Latest version: ${LATEST_SCHEMA_VERSION}`,
    );

    if (currentVersion >= LATEST_SCHEMA_VERSION) {
      console.log('[DB] Database schema is up to date.');
      await db.execute('PRAGMA foreign_keys = ON;');
      return;
    }

    console.log('[DB] Beginning migration transaction.');
    await db.execute('BEGIN TRANSACTION;');

    for (let v = currentVersion + 1; v <= LATEST_SCHEMA_VERSION; v++) {
      console.log(`[DB] Applying migration for version ${v}...`);
      const migrationSql = MIGRATIONS[v];

      if (!migrationSql) {
        throw new Error(`[DB] Missing migration script for version ${v}`);
      }

      // Split the SQL script into individual statements, filtering out empty ones.
      // This is safer for executeBatch or sequential execution.
      const statements = migrationSql
        .split(';')
        .map(sql => sql.trim())
        .filter(sql => sql.length > 0);

      if (statements.length === 0) {
        console.warn(
          `[DB] Migration script for version ${v} contained no valid SQL statements.`,
        );
        continue;
      }

      for (const statement of statements) {
        await db.execute(statement);
      }

      console.log(`[DB] Successfully applied migration for version ${v}`);
    }

    // Commit the transaction
    await db.execute('COMMIT;');
    console.log('[DB] Migration transaction committed.');

    console.log('[DB] Database migrations completed successfully.');

    currentVersionResult = await db.execute('PRAGMA user_version;');

    const finalFirstRow = currentVersionResult?.rows?.item(0);
    if (finalFirstRow && typeof finalFirstRow.user_version === 'number') {
      console.log(`[DB] Final schema version: ${finalFirstRow.user_version}`);
    }
  } catch (error) {
    console.error('[DB] Database migration failed:', error);

    try {
      db.execute('ROLLBACK;');
      console.log('[DB] Migration transaction rolled back.');
    } catch (rollbackError) {
      console.error(
        '[DB] Failed to rollback migration transaction:',
        rollbackError,
      );
    }

    throw error;
  }
};

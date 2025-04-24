// src/db/index.ts
import {open, type QuickSQLiteConnection} from 'react-native-quick-sqlite';
import {runMigrations} from './migrations'; // Import the function we just created

const DB_NAME = 'blockstracker.sqlite';

export const db: QuickSQLiteConnection = open({
  name: DB_NAME,
  // location: 'default', // Optional: specify location ('default', 'Library', 'Documents')
});

console.log(`[DB] Database connection configured for: ${DB_NAME}`);

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initializes the database by running migrations if necessary.
 * Ensures migrations are run only once.
 * @returns {Promise<void>} A promise that resolves when initialization is complete or throws an error if it fails.
 */
export const initializeDatabase = async (): Promise<void> => {
  if (initializationPromise) {
    console.log(
      '[DB] Initialization already in progress, returning existing promise.',
    );
    return initializationPromise;
  }

  if (isInitialized) {
    console.log('[DB] Database already initialized.');
    return Promise.resolve();
  }

  console.log('[DB] Starting database initialization...');
  initializationPromise = (async () => {
    try {
      await runMigrations(db);
      isInitialized = true;
      console.log('[DB] Database initialization successful.');
    } catch (error) {
      console.error('[DB] Database initialization failed:', error);
      isInitialized = false;
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

/**
 * Checks if the database has been successfully initialized.
 * @returns {boolean} True if initialized, false otherwise.
 */
export const isDatabaseInitialized = (): boolean => {
  return isInitialized;
};

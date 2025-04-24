// src/hooks/useDatabase.ts
import {useState, useEffect} from 'react';
import {db, initializeDatabase, isDatabaseInitialized} from '../../db'; // Adjust path
import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

interface DatabaseHookResult {
  db: QuickSQLiteConnection;
  isLoading: boolean; // Indicates if initialization is in progress
  error: Error | null; // Stores any initialization error
}

export const useDatabase = (): DatabaseHookResult => {
  const [isLoading, setIsLoading] = useState<boolean>(!isDatabaseInitialized());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initDb = async () => {
      if (!isDatabaseInitialized()) {
        console.log('[useDatabase] Hook mounted, initializing database...');
        setIsLoading(true);
        setError(null);
        try {
          await initializeDatabase();
          if (isMounted) {
            console.log(
              '[useDatabase] Database initialized successfully via hook.',
            );
            setIsLoading(false);
          }
        } catch (err: any) {
          console.error(
            '[useDatabase] Database initialization failed via hook.',
            err,
          );
          if (isMounted) {
            setError(err);
            setIsLoading(false);
          }
        }
      } else {
        console.log(
          '[useDatabase] Hook mounted, database already initialized.',
        );
        if (isMounted && isLoading) {
          setIsLoading(false);
        }
        if (isMounted && error) {
          setError(null);
        }
      }
    };

    initDb();

    return () => {
      isMounted = false; // Cleanup function
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {db, isLoading, error};
};

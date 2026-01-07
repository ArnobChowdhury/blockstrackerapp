import React, {
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { readData, storeData } from '../utils';
import { AppState, AppStateStatus, useColorScheme } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { useNetInfo } from '@react-native-community/netinfo';
import { syncService } from '../../services/SyncService';
import apiClient, {
  registerAuthFailureHandler,
  registerTokenRefreshHandler,
  setInMemoryToken,
} from '../../lib/apiClient';
import { jwtDecode } from 'jwt-decode';
import { UserService } from '../../services/UserService';
import { eventManager } from '../../services/EventManager';
import {
  SYNC_TRIGGER_REQUESTED,
  WRITE_OPERATION_COMPLETED,
} from '../constants';
import { SettingsRepository } from '../../db/repository';
import { db } from '../../db';
import { notificationService } from '../../services/NotificationService';
import { dataMigrationService } from '../../services/DataMigrationService';

export interface User {
  id: string;
  email: string;
  isPremium?: boolean;
}

interface AppContextProps {
  isDarkMode: boolean;
  userPreferredTheme: 'light' | 'dark' | 'system';
  changeTheme: (theme: string) => void;
  user: User | null;
  isSigningIn: boolean;
  signIn: (token: string, refreshToken: string) => void;
  signOut: () => void;
  isSyncing: boolean;
  isSnackbarVisible: boolean;
  snackbarMessage: string;
  showSnackbar: (message: string) => void;
  hideSnackbar: () => void;
  firstSyncDone: boolean;
  checkAnonData: boolean;
  setCheckAnonData: (value: boolean) => void;
}

const AppContext = React.createContext<AppContextProps | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const getIsDarkMode = (
  preferredTheme: string,
  colorScheme: string | null | undefined,
) => {
  if (preferredTheme === 'system') {
    return colorScheme === 'dark';
  } else {
    return preferredTheme === 'dark';
  }
};

export const AppProvider = ({ children }: AppProviderProps) => {
  const [userPreferredTheme, setUserPreferredTheme] = useState<
    'light' | 'dark' | 'system'
  >('system');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const colorScheme = useColorScheme();
  const netInfo = useNetInfo();
  const [isSyncing, setIsSyncing] = useState(false);

  const userService = useMemo(() => new UserService(), []);
  const settingsRepo = useMemo(() => new SettingsRepository(db), []);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const TWO_MINUTES = 2 * 60 * 1000;
  const [isSnackbarVisible, setIsSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [checkAnonData, setCheckAnonData] = useState(false);

  const showSnackbar = useCallback((message: string) => {
    setSnackbarMessage(message);
    setIsSnackbarVisible(true);
  }, []);

  const hideSnackbar = useCallback(() => {
    setIsSnackbarVisible(false);
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      const theme = await readData('theme');
      if (theme) {
        setUserPreferredTheme(theme as 'light' | 'dark' | 'system');
      }
    };
    loadTheme();
  }, []);

  const changeTheme = useCallback(async (theme: string) => {
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
      console.error('Invalid theme:', theme);
      return;
    }

    await storeData('theme', theme);
    console.log('Changing theme to', theme);
    setUserPreferredTheme(theme);
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(true);
  const [firstSyncDone, setFirstSyncDone] = useState(true);

  useEffect(() => {
    setIsDarkMode(getIsDarkMode(userPreferredTheme, colorScheme));
  }, [userPreferredTheme, colorScheme]);

  const updateTokens = useCallback(
    async (accessToken: string, refreshToken: string) => {
      try {
        await Keychain.setGenericPassword('user', accessToken);
        await Keychain.setGenericPassword('refreshToken', refreshToken, {
          service: 'refreshToken',
        });
        setInMemoryToken(accessToken);
        console.log('[AuthContext] Tokens updated successfully.');
      } catch (error) {
        console.error('[AuthContext] Error storing token', error);
      }
    },
    [],
  );

  const signIn = useCallback(
    async (accessToken: string, refreshToken: string, silent = false) => {
      if (!silent) {
        setIsSigningIn(true);
      }
      try {
        const decoded = jwtDecode<{
          email: string;
          user_id: string;
          is_premium: boolean;
        }>(accessToken);

        if (!decoded.user_id || !decoded.email) {
          throw new Error('Invalid token received from server.');
        }

        const oldUser = await userService.getUserById(decoded.user_id);

        await userService.saveUserLocally({
          id: decoded.user_id,
          email: decoded.email,
          isPremium: decoded.is_premium,
        });

        await updateTokens(accessToken, refreshToken);

        if (oldUser && !oldUser.isPremium && decoded.is_premium) {
          await dataMigrationService.queueAllDataForSync(decoded.user_id);
        }

        setUser({
          id: decoded.user_id,
          email: decoded.email,
          isPremium: decoded.is_premium,
        });

        if (decoded.is_premium) {
          setFirstSyncDone(false);
        } else {
          setFirstSyncDone(true);
        }
        await notificationService.recalculateAndScheduleNotifications(
          decoded.user_id,
        );
      } catch (error: any) {
        console.error(
          '[AuthContext] Failed to process sign-in:',
          error.message,
        );
        throw new Error(
          `Sign-in failed: ${error.message || 'An unknown error occurred.'}`,
        );
      } finally {
        if (!silent) {
          setIsSigningIn(false);
        }
      }
    },
    [updateTokens, userService],
  );

  const checkPremiumStatus = useCallback(async () => {
    try {
      const accessCreds = await Keychain.getGenericPassword();
      const refreshCreds = await Keychain.getGenericPassword({
        service: 'refreshToken',
      });

      if (accessCreds && refreshCreds) {
        const response = await apiClient.post('/auth/refresh', {
          accessToken: accessCreds.password,
          refreshToken: refreshCreds.password,
        });

        if (response.data?.result?.data) {
          const { accessToken: newAccess, refreshToken: newRefresh } =
            response.data.result.data;
          await signIn(newAccess, newRefresh, true);
        }
      }
    } catch (error) {
      console.log('[AppContext] checkPremiumStatus failed (silent):', error);
    }
  }, [signIn]);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const credentials = await Keychain.getGenericPassword();
        if (credentials) {
          console.log('[AuthContext] Token found in keychain.');
          const accessToken = credentials.password;
          setInMemoryToken(accessToken);

          const decoded = jwtDecode<{
            email: string;
            user_id: string;
            is_premium: boolean;
          }>(accessToken);

          const oldUser = await userService.getUserById(decoded.user_id);

          await userService.saveUserLocally({
            id: decoded.user_id,
            email: decoded.email,
            isPremium: decoded.is_premium,
          });

          if (oldUser && !oldUser.isPremium && decoded.is_premium) {
            await dataMigrationService.queueAllDataForSync(decoded.user_id);
          }

          if (decoded.user_id && decoded.email) {
            setUser({
              id: decoded.user_id,
              email: decoded.email,
              isPremium: decoded.is_premium,
            });

            if (decoded.is_premium) {
              setFirstSyncDone(false);
            } else {
              setFirstSyncDone(true);
            }

            await notificationService.recalculateAndScheduleNotifications(
              decoded.user_id,
            );
            checkPremiumStatus();
          }
        } else {
          console.log('[AuthContext] No token found in keychain.');
          setFirstSyncDone(true);
          await notificationService.recalculateAndScheduleNotifications(null);
        }
      } catch (error) {
        console.error("[AuthContext] Couldn't load token from keychain", error);
      } finally {
        setIsSigningIn(false);
      }
    };

    loadToken();
  }, [userService, checkPremiumStatus]);

  const signOut = useCallback(async () => {
    setIsSigningIn(true);
    try {
      await apiClient.post('/auth/signout');
      console.log(
        '[AuthContext] Successfully invalidated tokens on the backend.',
      );
    } catch (apiError: any) {
      console.error(
        '[AuthContext] Backend sign-out failed, proceeding with local sign-out:',
        apiError.message,
      );
    } finally {
      try {
        await Keychain.resetGenericPassword();
        await Keychain.resetGenericPassword({ service: 'refreshToken' });
        setUser(null);
        setFirstSyncDone(true);
        setInMemoryToken(null);
        console.log(
          '[AuthContext] Local user session and tokens cleared successfully.',
        );
        await notificationService.recalculateAndScheduleNotifications(null);
      } catch (keychainError: any) {
        console.error(
          '[AuthContext] Failed to clear local tokens from keychain:',
          keychainError.message,
        );
      } finally {
        setIsSigningIn(false);
      }
    }
  }, []);

  const handleAuthFailure = useCallback(() => {
    showSnackbar(
      'Failed to refresh your session. Sync is paused. Please sign out and sign in again to resume.',
    );
  }, [showSnackbar]);

  useEffect(() => {
    registerAuthFailureHandler(handleAuthFailure);
    registerTokenRefreshHandler(updateTokens);
  }, [handleAuthFailure, updateTokens]);

  const runAndRescheduleSync = useCallback(async () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    if (appState.current === 'active' && user && user.isPremium) {
      console.log('[SyncManager] App is active, running sync...');
      setIsSyncing(true);
      try {
        await syncService.runSync(user.id);
        await settingsRepo.setLastSync(Date.now(), user.id);
        await notificationService.recalculateAndScheduleNotifications(user.id);
      } catch (error) {
        console.error('[SyncManager] Error during sync execution:', error);
      } finally {
        setIsSyncing(false);
        setFirstSyncDone(true);
      }

      console.log(
        `[SyncManager] Scheduling next sync in ${TWO_MINUTES / 1000} seconds.`,
      );
      syncTimerRef.current = setTimeout(runAndRescheduleSync, TWO_MINUTES);
    } else {
      console.log(
        '[SyncManager] Skipping sync run (app not active or user not premium).',
      );
    }
  }, [user, settingsRepo, TWO_MINUTES]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
      if (nextAppState === 'active') {
        checkPremiumStatus();
        await notificationService.recalculateAndScheduleNotifications(
          user ? user.id : null,
        );

        if (user && user.isPremium) {
          console.log('[SyncManager] App has come to the foreground.');
          if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
          }

          const lastSync = await settingsRepo.getLastSync(user.id);
          const now = Date.now();

          if (now - lastSync > TWO_MINUTES) {
            console.log(
              '[SyncManager] Last sync was more than 2 minutes ago. Syncing immediately.',
            );
            runAndRescheduleSync();
          } else {
            const timeUntilNextSync = TWO_MINUTES - (now - lastSync);
            console.log(
              `[SyncManager] Scheduling next sync in ${Math.round(
                timeUntilNextSync / 1000,
              )} seconds.`,
            );
            syncTimerRef.current = setTimeout(
              runAndRescheduleSync,
              timeUntilNextSync,
            );
          }
        }
      } else {
        console.log(
          '[SyncManager] App has gone to the background. Clearing scheduled sync.',
        );
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
          syncTimerRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    if (appState.current === 'active' && user && user.isPremium) {
      runAndRescheduleSync();
    }

    return () => {
      subscription.remove();
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [
    runAndRescheduleSync,
    settingsRepo,
    TWO_MINUTES,
    user,
    checkPremiumStatus,
  ]);

  useEffect(() => {
    const unsubscribe = eventManager.on(
      SYNC_TRIGGER_REQUESTED,
      runAndRescheduleSync,
    );

    return () => {
      unsubscribe();
    };
  }, [runAndRescheduleSync]);

  const wasOnline = useRef(false);

  useEffect(() => {
    const isOnline =
      netInfo.isConnected === true && netInfo.isInternetReachable === true;

    if (isOnline && !wasOnline.current && user && user.isPremium) {
      console.log(
        '[Network] Connection restored. Checking for pending operations.',
      );
      runAndRescheduleSync();
    }

    wasOnline.current = isOnline;
  }, [
    netInfo.isConnected,
    netInfo.isInternetReachable,
    runAndRescheduleSync,
    user,
  ]);

  useEffect(() => {
    const onWriteOperation = () => {
      notificationService.recalculateAndScheduleNotifications(
        user ? user.id : null,
      );
    };

    // sourcery skip: inline-immediately-returned-variable
    const unsubscribe = eventManager.on(
      WRITE_OPERATION_COMPLETED,
      onWriteOperation,
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const onPremiumStatusUpdated = async (data: any) => {
      console.log('[AppContext] Premium status updated. Refreshing tokens.');
      if (data?.accessToken && data?.refreshToken) {
        await signIn(data.accessToken, data.refreshToken);
      }
    };

    // sourcery skip: inline-immediately-returned-variable
    const unsubscribe = eventManager.on(
      'PREMIUM_STATUS_UPDATED',
      onPremiumStatusUpdated,
    );
    return unsubscribe;
  }, [signIn]);

  const value = useMemo(
    () => ({
      userPreferredTheme,
      changeTheme,
      isDarkMode,
      user,
      isSigningIn,
      signIn,
      signOut,
      isSyncing,
      isSnackbarVisible,
      snackbarMessage,
      showSnackbar,
      hideSnackbar,
      firstSyncDone,
      checkAnonData,
      setCheckAnonData,
    }),
    [
      userPreferredTheme,
      changeTheme,
      isDarkMode,
      user,
      isSigningIn,
      signIn,
      signOut,
      isSyncing,
      isSnackbarVisible,
      snackbarMessage,
      showSnackbar,
      hideSnackbar,
      firstSyncDone,
      checkAnonData,
      setCheckAnonData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

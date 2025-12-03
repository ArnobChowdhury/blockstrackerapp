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
import { useColorScheme } from 'react-native';
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
import { SYNC_TRIGGER_REQUESTED } from '../constants';

export interface User {
  id: string;
  email: string;
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

  const [isSnackbarVisible, setIsSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

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

  useEffect(() => {
    const loadToken = async () => {
      try {
        const credentials = await Keychain.getGenericPassword();
        if (credentials) {
          console.log('[AuthContext] Token found in keychain.');
          const accessToken = credentials.password;
          setInMemoryToken(accessToken);

          const decoded = jwtDecode<{ email: string; user_id: string }>(
            accessToken,
          );
          if (decoded.user_id && decoded.email) {
            setUser({ id: decoded.user_id, email: decoded.email });
          }
        } else {
          console.log('[AuthContext] No token found in keychain.');
        }
      } catch (error) {
        console.error("[AuthContext] Couldn't load token from keychain", error);
      } finally {
        setIsSigningIn(false);
      }
    };

    loadToken();
  }, []);

  useEffect(() => {
    if (user) {
      syncService.runSync();
    }
  }, [user]);

  useEffect(() => {
    setIsDarkMode(getIsDarkMode(userPreferredTheme, colorScheme));
  }, [userPreferredTheme, colorScheme]);

  const wasOnline = useRef(false);

  useEffect(() => {
    const isOnline =
      netInfo.isConnected === true && netInfo.isInternetReachable === true;

    if (isOnline && !wasOnline.current && user) {
      console.log(
        '[Network] Connection restored. Checking for pending operations.',
      );
      syncService.runSync();
    }

    wasOnline.current = isOnline;
  }, [netInfo.isConnected, netInfo.isInternetReachable, user]);

  useEffect(() => {
    syncService.initialize({ onSyncStatusChange: setIsSyncing });
  }, []);

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
    async (accessToken: string, refreshToken: string) => {
      setIsSigningIn(true);
      try {
        const decoded = jwtDecode<{ email: string; user_id: string }>(
          accessToken,
        );

        if (!decoded.user_id || !decoded.email) {
          throw new Error('Invalid token received from server.');
        }

        const userService = new UserService();
        await userService.saveUserLocally({
          id: decoded.user_id,
          email: decoded.email,
        });

        await updateTokens(accessToken, refreshToken);
        setUser({ id: decoded.user_id, email: decoded.email });
      } catch (error: any) {
        console.error(
          '[AuthContext] Failed to process sign-in:',
          error.message,
        );
        throw new Error(
          `Sign-in failed: ${error.message || 'An unknown error occurred.'}`,
        );
      } finally {
        setIsSigningIn(false);
      }
    },
    [updateTokens],
  );

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
        setInMemoryToken(null);
        console.log(
          '[AuthContext] Local user session and tokens cleared successfully.',
        );
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

  const runAndRescheduleSync = () => {};

  useEffect(() => {
    const unsubscribe = eventManager.on(
      SYNC_TRIGGER_REQUESTED,
      runAndRescheduleSync,
    );

    return () => {
      unsubscribe();
    };
  }, [runAndRescheduleSync]);

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

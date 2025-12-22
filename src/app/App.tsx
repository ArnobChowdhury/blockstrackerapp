/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { initializeDatabase } from '../db';
import { ANDROID_TASK_REMINDER_NOTIFICATION_CHANNEL_ID } from '../shared/constants';
import notifee, { AndroidImportance } from '@notifee/react-native';
import BackgroundFetch from 'react-native-background-fetch';
import 'react-native-gesture-handler';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import {
  NavigationContainer,
  DefaultTheme as ReactNavigationDefaultTheme,
  DarkTheme as ReactNavigationDarkTheme,
  Theme,
} from '@react-navigation/native';
import RootNavigator from '../navigation/RootNavigator'; // Adjusted path
import { CombinedLightTheme, CombinedDarkTheme } from './theme/theme';
import { AppProvider, useAppContext } from '../shared/contexts/useAppContext';
import { enableSimpleNullHandling } from 'react-native-nitro-sqlite';
import { en, registerTranslation } from 'react-native-paper-dates';
import { configureGoogleSignIn } from '../lib/googleAuth';
import { backgroundTask } from '../services/BackgroundTask';

configureGoogleSignIn();
enableSimpleNullHandling();
registerTranslation('en', en);

const AppContent = () => {
  const { isDarkMode, isSnackbarVisible, snackbarMessage, hideSnackbar } =
    useAppContext();

  let navigationTheme: Theme;
  if (isDarkMode) {
    navigationTheme = { ...ReactNavigationDarkTheme };
    navigationTheme.colors = {
      ...ReactNavigationDarkTheme.colors,
      background: CombinedDarkTheme.colors.surface,
    };
    navigationTheme.dark = true;
  } else {
    navigationTheme = { ...ReactNavigationDefaultTheme };
    navigationTheme.colors = {
      ...ReactNavigationDefaultTheme.colors,
      background: CombinedLightTheme.colors.surface,
    };
    navigationTheme.dark = false;
  }

  return (
    <PaperProvider theme={isDarkMode ? CombinedDarkTheme : CombinedLightTheme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={
          isDarkMode
            ? CombinedDarkTheme.colors.surface
            : CombinedLightTheme.colors.surface
        }
      />
      <NavigationContainer theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
      <Snackbar
        visible={isSnackbarVisible}
        onDismiss={hideSnackbar}
        duration={3000}
        action={{
          label: 'Dismiss',
          onPress: hideSnackbar,
        }}>
        {snackbarMessage}
      </Snackbar>
    </PaperProvider>
  );
};

function App(): React.JSX.Element {
  const [isDbInitialized, setIsDBInitialized] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
    const setupNotificationChannel = async () => {
      await notifee.createChannel({
        id: ANDROID_TASK_REMINDER_NOTIFICATION_CHANNEL_ID,
        name: 'Task reminders',
        importance: AndroidImportance.DEFAULT,
      });
      console.log('[App] Notification channel created/ensured.');
    };

    setupNotificationChannel();
  }, []);

  useEffect(() => {
    BackgroundFetch.configure(
      {
        minimumFetchInterval: 15,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      },
      async taskId => {
        console.log('[App] BackgroundFetch event received:', taskId);
        await backgroundTask({ taskId, timeout: false });
      },
      taskId => {
        console.log('[App] BackgroundFetch timeout:', taskId);
        BackgroundFetch.finish(taskId);
      },
    ).then(status => {
      console.log('[App] BackgroundFetch configured. Status:', status);
    });
  }, []);

  useEffect(() => {
    console.log('[App] Attempting to initialize database...');
    initializeDatabase()
      .then(() => {
        console.log('[App] Database initialized successfully!');
        setIsDBInitialized(true);
      })
      .catch(error => {
        console.error('[App] Error initializing database:', error);
        setDbError(error);
        // handle critical failure - maybe show an error screen
      });
  }, []);

  if (dbError) {
    return <Text>Error loading application data. Please restart.</Text>; // Or a dedicated error component
  }
  if (!isDbInitialized) {
    return <Text>Loading...</Text>; // Or a splash screen / loading indicator
  }

  return (
    <AppProvider>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </AppProvider>
  );
}

export default App;

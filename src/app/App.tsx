/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { initializeDatabase } from '../db'; // Adjust path if needed
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
import { configureGoogleSignIn } from '../services/googleSignIn';

configureGoogleSignIn();
enableSimpleNullHandling();
registerTranslation('en', en);

const AppContent = () => {
  const { isDarkMode } = useAppContext();

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
    </PaperProvider>
  );
};

function App(): React.JSX.Element {
  const [isDbInitialized, setIsDBInitialized] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

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

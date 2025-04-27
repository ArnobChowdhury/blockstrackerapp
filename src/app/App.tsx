/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
import {StatusBar} from 'react-native';
import {Text} from 'react-native-paper';
import {initializeDatabase} from '../db'; // Adjust path if needed

import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PaperProvider} from 'react-native-paper';
import {
  NavigationContainer,
  DefaultTheme as ReactNavigationDefaultTheme,
} from '@react-navigation/native';
import RootNavigator from '../navigation/RootNavigator'; // Adjusted path
import {theme} from './theme/theme';
import {enableSimpleNullHandling} from 'react-native-nitro-sqlite';

enableSimpleNullHandling();

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
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.surface} // Match status bar background to screen background
        />

        <NavigationContainer
          theme={{
            ...ReactNavigationDefaultTheme,
            colors: {
              ...ReactNavigationDefaultTheme.colors,
              background: theme.colors.surface,
            },
            dark: true,
          }}>
          <RootNavigator />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;

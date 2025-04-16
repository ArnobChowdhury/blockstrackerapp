/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PaperProvider} from 'react-native-paper';
import {NavigationContainer} from '@react-navigation/native';
import RootNavigator from '../navigation/RootNavigator'; // Adjusted path

// Removed unused imports like ScrollView, StatusBar, StyleSheet, Text, View, Colors, etc.
// Removed Section component definition
// Removed styles object

function App(): React.JSX.Element {
  // Removed isDarkMode and backgroundStyle as they are no longer directly used here
  // Removed safePadding

  return (
    <SafeAreaProvider>
      <PaperProvider>
        {/* NavigationContainer wraps the navigator */}
        <NavigationContainer>
          {/* RootNavigator renders the screens based on navigation state */}
          <RootNavigator />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;

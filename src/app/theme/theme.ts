import {
  MD3LightTheme,
  configureFonts,
  MD3DarkTheme,
  adaptNavigationTheme,
} from 'react-native-paper';
import {
  DefaultTheme as NavigationDefaultTheme,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { MD3Theme } from 'react-native-paper/lib/typescript/types';

const customFontFamilyOverrides = {
  displayLarge: { fontFamily: 'HankenGrotesk-Bold' },
  displayMedium: { fontFamily: 'HankenGrotesk-Bold' },
  displaySmall: { fontFamily: 'HankenGrotesk-SemiBold' },

  headlineLarge: { fontFamily: 'HankenGrotesk-SemiBold' },
  headlineMedium: { fontFamily: 'HankenGrotesk-SemiBold' },
  headlineSmall: { fontFamily: 'HankenGrotesk-Medium' },

  titleLarge: { fontFamily: 'HankenGrotesk-SemiBold' },
  titleMedium: { fontFamily: 'HankenGrotesk-Medium' },
  titleSmall: { fontFamily: 'HankenGrotesk-Medium' },

  bodyLarge: { fontFamily: 'HankenGrotesk-Regular' },
  bodyMedium: { fontFamily: 'HankenGrotesk-Regular' },
  bodySmall: { fontFamily: 'HankenGrotesk-Regular' },

  labelLarge: { fontFamily: 'HankenGrotesk-Medium' },
  labelMedium: { fontFamily: 'HankenGrotesk-Medium' },
  labelSmall: { fontFamily: 'HankenGrotesk-Regular' },
};

// Use configureFonts to merge custom font families with default MD3 typescale properties
const fonts = configureFonts({ config: customFontFamilyOverrides });

const { LightTheme: NavLightTheme, DarkTheme: NavDarkTheme } =
  adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
  });

export const CombinedLightTheme: MD3Theme = {
  ...MD3LightTheme,
  ...NavLightTheme,
  fonts: fonts,
  colors: {
    ...MD3LightTheme.colors,
    ...NavLightTheme.colors,
    primary: '#008ab4',
    secondary: '#11C498',
    primaryContainer: '#008ab4',
    onPrimaryContainer: '#ffffff',

    // influences bottom navigation bar
    secondaryContainer: '#11C498',
    onSecondaryContainer: '#ffffff',

    surface: '#FFFFFF',
    onSurface: '#333333',
    // input fields
    surfaceVariant: '#008ab440',
    onSurfaceVariant: '#444444',

    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: '#f9f9f9',
      level2: '#f6f6f6',
      level3: '#eeeeee',
    },
  },
};

export const CombinedDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  ...NavDarkTheme,
  fonts: fonts,
  colors: {
    ...MD3DarkTheme.colors,
    ...NavDarkTheme.colors,
    primary: '#008ab4',
    secondary: '#11C498',
    primaryContainer: '#008ab4',
    onPrimaryContainer: '#ffffff',

    // influences bottom navigation bar
    secondaryContainer: '#11C498',
    onSecondaryContainer: '#ffffff',

    surface: '#121212',
    onSurface: '#EAEAEA',

    // input fields
    surfaceVariant: '#008ab440',
    onSurfaceVariant: '#CCCCCC',

    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: '#1e1e1e',
      level2: '#242424',
      level3: '#282828',
    },
  },
};

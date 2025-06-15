import {
  MD3LightTheme as DefaultTheme,
  configureFonts,
} from 'react-native-paper';
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

export const theme: MD3Theme = {
  ...DefaultTheme,
  fonts: fonts,
  colors: {
    ...DefaultTheme.colors,
    primary: '#007A9F',
    secondary: '#11C498',
    primaryContainer: '#007A9F',
    onPrimaryContainer: '#ffffff',

    // influences bottom navigation bar
    secondaryContainer: '#11C498',
    onSecondaryContainer: '#ffffff',

    surface: '#FFFFFF',
    onSurface: '#333333',
    // input fields
    surfaceVariant: '#007A9F40',
    onSurfaceVariant: '#444444',

    elevation: {
      ...DefaultTheme.colors.elevation,
      level1: '#f9f9f9',
      level2: '#f6f6f6',
      level3: '#eeeeee',
    },
  },
};

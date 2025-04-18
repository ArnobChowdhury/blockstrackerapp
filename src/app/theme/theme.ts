import {MD3LightTheme as DefaultTheme} from 'react-native-paper';
import {MD3Theme} from 'react-native-paper/lib/typescript/types';

const customFontFamily = {
  displayLarge: {fontFamily: 'HankenGrotesk-Bold'},
  displayMedium: {fontFamily: 'HankenGrotesk-Bold'},
  displaySmall: {fontFamily: 'HankenGrotesk-SemiBold'},

  headlineLarge: {fontFamily: 'HankenGrotesk-SemiBold'},
  headlineMedium: {fontFamily: 'HankenGrotesk-SemiBold'},
  headlineSmall: {fontFamily: 'HankenGrotesk-Medium'},

  titleLarge: {fontFamily: 'HankenGrotesk-SemiBold'},
  titleMedium: {fontFamily: 'HankenGrotesk-Medium'},
  titleSmall: {fontFamily: 'HankenGrotesk-Medium'},

  bodyLarge: {fontFamily: 'HankenGrotesk-Regular'},
  bodyMedium: {fontFamily: 'HankenGrotesk-Regular'},
  bodySmall: {fontFamily: 'HankenGrotesk-Regular'},

  labelLarge: {fontFamily: 'HankenGrotesk-Medium'},
  labelMedium: {fontFamily: 'HankenGrotesk-Medium'},
  labelSmall: {fontFamily: 'HankenGrotesk-Regular'},
};

export const theme: MD3Theme = {
  ...DefaultTheme,
  fonts: {
    ...DefaultTheme.fonts,
    ...Object.fromEntries(
      Object.entries(customFontFamily).map(([key, override]) => [
        key,
        {
          ...DefaultTheme.fonts[key as keyof typeof DefaultTheme.fonts],
          ...override,
        },
      ]),
    ),
  },
  colors: {
    ...DefaultTheme.colors,
    primary: '#007A9F',
    secondary: '#11C498',
    surface: '#FFFFFF',
  },
};

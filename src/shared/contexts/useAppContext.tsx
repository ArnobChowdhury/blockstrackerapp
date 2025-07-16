import React, {
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import { readData, storeData } from '../utils';
import { useColorScheme } from 'react-native';

interface AppContextProps {
  isDarkMode: boolean;
  userPreferredTheme: 'light' | 'dark' | 'system';
  changeTheme: (theme: string) => void;
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

  readData('theme').then(theme => {
    if (theme) {
      setUserPreferredTheme(theme as 'light' | 'dark' | 'system');
      setIsDarkMode(getIsDarkMode(theme, colorScheme));
    }
  });

  const changeTheme = useCallback(
    async (theme: string) => {
      if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
        console.error('Invalid theme:', theme);
        return;
      }

      await storeData('theme', theme);
      console.log('Changing theme to', theme);
      setUserPreferredTheme(theme);
      setIsDarkMode(getIsDarkMode(theme, colorScheme));
    },
    [colorScheme],
  );

  const value = useMemo(
    () => ({ userPreferredTheme, changeTheme, isDarkMode }),
    [userPreferredTheme, changeTheme, isDarkMode],
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

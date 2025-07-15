import React, { useContext, useState, ReactNode, useMemo } from 'react';
import { readData, storeData } from '../utils';

interface AppContextProps {
  currentTheme: 'light' | 'dark' | 'system';
  changeTheme: (theme: string) => void;
}

const AppContext = React.createContext<AppContextProps | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(
    'system',
  );

  readData('theme').then(theme => {
    if (theme) {
      setCurrentTheme(theme as 'light' | 'dark' | 'system');
    }
  });

  const changeTheme = async (theme: string) => {
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
      console.error('Invalid theme:', theme);
      return;
    }

    await storeData('theme', theme);
    console.log('Changing theme to', theme);
    setCurrentTheme(theme);
  };

  const value = useMemo(() => ({ currentTheme, changeTheme }), [currentTheme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

import React, { useContext, useState, ReactNode, useMemo } from 'react';

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
    'light',
  );

  const changeTheme = (theme: string) => {
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
      console.error('Invalid theme:', theme);
      return;
    }
    console.log('Changing theme to');
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

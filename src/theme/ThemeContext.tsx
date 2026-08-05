import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, LightTheme } from './colors';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: typeof DarkTheme;
  mode: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DarkTheme,
  mode: 'dark',
  toggleTheme: () => {},
  isDark: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem('themeMode').then(saved => {
      if (saved === 'light' || saved === 'dark') setMode(saved);
    });
  }, []);

  const toggleTheme = async () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    await AsyncStorage.setItem('themeMode', next);
  };

  const theme = mode === 'dark' ? DarkTheme : LightTheme;

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme, isDark: mode === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { storage, STORAGE_KEYS } from '../storage/mmkv';

export interface ThemeColors {
  background: string;
  card: string;
  cardSecondary: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentInverted: string;
  tabBarBg: string;
  tabBarBorder: string;
  scanBtnBg: string;
  scanBtnText: string;
  secondaryActionBg: string;
  secondaryActionText: string;
  statusBarStyle: 'light' | 'dark';
}

export const lightColors: ThemeColors = {
  background: '#F8F9FA',
  card: '#FFFFFF',
  cardSecondary: '#F1F5F9',
  border: 'rgba(241, 245, 249, 0.9)',
  borderSubtle: '#F8F9FA',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  accent: '#0F172A',
  accentInverted: '#FFFFFF',
  tabBarBg: '#FFFFFF',
  tabBarBorder: 'rgba(241, 245, 249, 0.9)',
  scanBtnBg: '#161618',
  scanBtnText: '#FFFFFF',
  secondaryActionBg: '#FFFFFF',
  secondaryActionText: '#18181B',
  statusBarStyle: 'dark',
};

export const darkColors: ThemeColors = {
  background: '#09090B',
  card: '#18181B',
  cardSecondary: '#27272A',
  border: '#27272A',
  borderSubtle: '#1F1F23',
  textPrimary: '#F8FAFC',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  accent: '#FAFAFA',
  accentInverted: '#09090B',
  tabBarBg: '#18181B',
  tabBarBorder: '#27272A',
  scanBtnBg: '#FAFAFA',
  scanBtnText: '#09090B',
  secondaryActionBg: '#18181B',
  secondaryActionText: '#F8FAFC',
  statusBarStyle: 'light',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setDarkMode: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
  setDarkMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    return storage.getBoolean(STORAGE_KEYS.IS_DARK_MODE) ?? false;
  });

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      storage.setBoolean(STORAGE_KEYS.IS_DARK_MODE, next);
      return next;
    });
  }, []);

  const setDarkMode = useCallback((enabled: boolean) => {
    setIsDark(enabled);
    storage.setBoolean(STORAGE_KEYS.IS_DARK_MODE, enabled);
  }, []);

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const value = useMemo(
    () => ({
      isDark,
      colors,
      toggleTheme,
      setDarkMode,
    }),
    [isDark, colors, toggleTheme, setDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);

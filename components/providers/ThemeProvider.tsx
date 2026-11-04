'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

/**
 * OrdeX is light-only: no dark class on <html>, no system preference.
 * Context kept so imports don't break; toggle is a no-op.
 */
type Theme = 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (_theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Ignored — app is always light */
  defaultTheme?: Theme;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.style.colorScheme = 'light';
    try {
      localStorage.removeItem('ordex-theme');
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme: 'light',
      toggleTheme: () => {},
      setTheme: () => {},
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

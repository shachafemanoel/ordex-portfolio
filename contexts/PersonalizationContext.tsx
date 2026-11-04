'use client';

import { useRBAC } from '@/hooks/useRBAC';
import type { UserRole } from '@/lib/types';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type UiDensity = 'comfort' | 'compact';
export type Theme = 'light' | 'dark' | 'system';

interface UserPreferences {
  density: UiDensity;
  theme: Theme;
  favorites: string[]; // paths of pinned modules
}

interface PersonalizationContextType {
  role: UserRole;
  preferences: UserPreferences;
  isCompact: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  toggleFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
}

const defaultPreferences: UserPreferences = {
  density: 'comfort',
  theme: 'light',
  favorites: [],
};

const PersonalizationContext = createContext<PersonalizationContextType | undefined>(undefined);

export function PersonalizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useRBAC();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  // Determine effective role safely
  const role: UserRole =
    (user?.role && typeof user.role === 'object' ? (user.role as any).key : user?.role) ??
    'INSTALLER'; // Default safe role

  // Load preferences from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ordex_prefs');
      if (stored) {
        setPreferences((prev) => ({ ...prev, ...JSON.parse(stored) }));
      } else {
        // Set default density based on role
        const defaultDensity = role === 'ADMIN' ? 'compact' : 'comfort';
        setPreferences((prev) => ({ ...prev, density: defaultDensity }));
      }
    } catch (e) {
      console.error('Failed to load preferences', e);
    }
  }, [role]);

  // Persist preferences
  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem('ordex_prefs', JSON.stringify(next));
      return next;
    });
  };

  const toggleFavorite = (path: string) => {
    setPreferences((prev) => {
      const nextFavorites = prev.favorites.includes(path)
        ? prev.favorites.filter((p) => p !== path)
        : [...prev.favorites, path];

      const next = { ...prev, favorites: nextFavorites };
      localStorage.setItem('ordex_prefs', JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = (path: string) => preferences.favorites.includes(path);

  const isCompact = preferences.density === 'compact';

  return (
    <PersonalizationContext.Provider
      value={{
        role,
        preferences,
        isCompact,
        updatePreferences,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </PersonalizationContext.Provider>
  );
}

export function usePersonalization() {
  const context = useContext(PersonalizationContext);
  if (context === undefined) {
    throw new Error('usePersonalization must be used within a PersonalizationProvider');
  }
  return context;
}

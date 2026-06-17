// Zustand-Store für Authentifizierungs-State
// Speichert: Benutzer-Info, Access Token, Auth-Status

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role } from '@schuladmin/shared';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  totpEnabled: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  // Aktionen
  setAuth: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'schuladmin-auth',
      // Nur nicht-sensible Daten persistieren
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Access Token NICHT persistieren (nur im Memory halten)
      }),
    }
  )
);

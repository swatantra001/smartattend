import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('prof_user', JSON.stringify(user));
    localStorage.setItem('prof_access', accessToken);
    localStorage.setItem('prof_refresh', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('prof_user');
    localStorage.removeItem('prof_access');
    localStorage.removeItem('prof_refresh');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    try {
      const userStr = localStorage.getItem('prof_user');
      const access  = localStorage.getItem('prof_access');
      const refresh  = localStorage.getItem('prof_refresh');
      if (userStr && access) {
        const user = JSON.parse(userStr) as User;
        set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true, isInitialized: true });
        return;
      }
    } catch {}
    set({ isInitialized: true });
  },
}));
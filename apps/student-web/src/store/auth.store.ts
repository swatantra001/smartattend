import { create } from 'zustand';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User, access: string, refresh: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false,

  setAuth: (user, access, refresh) => {
    localStorage.setItem('st_user', JSON.stringify(user));
    localStorage.setItem('st_access', access);
    localStorage.setItem('st_refresh', refresh);
    set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('st_user');
    localStorage.removeItem('st_access');
    localStorage.removeItem('st_refresh');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  setUser: (user) => {
    localStorage.setItem('st_user', JSON.stringify(user));
    set({ user });
  },

  loadFromStorage: () => {
    try {
      const user = JSON.parse(localStorage.getItem('st_user') || 'null');
      const access = localStorage.getItem('st_access');
      const refresh = localStorage.getItem('st_refresh');
      if (user && access) {
        set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },
}));
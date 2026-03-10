import { create } from 'zustand';

interface AdminUser {
  user_id: string;
  email: string;
  role: string;
  college_id: string;
}

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean; // To track if we've loaded from storage
  setAuth: (user: AdminUser, token: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitialized: false, // Add this

  setAuth: (user, accessToken) => {
    localStorage.setItem('admin_token', accessToken);
    localStorage.setItem('admin_user', JSON.stringify(user));
    set({ user, accessToken, isAuthenticated: true, isInitialized: true });

  },

  clearAuth: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    set({ user: null, accessToken: null, isAuthenticated: false, isInitialized: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('admin_token');
    const userStr = localStorage.getItem('admin_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, accessToken: token, isAuthenticated: true, isInitialized: true });
      } catch (err) {
        console.error('Failed to parse admin user from storage:', err);
        set({ user: null, accessToken: null, isAuthenticated: false, isInitialized: false });
      }
    } else {
      set({ user: null, accessToken: null, isAuthenticated: false, isInitialized: true });
    }
  },
}));
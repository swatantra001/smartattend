import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

interface ProfessorUser {
  user_id: string;
  email: string;
  role: string;
  college_id: string;
  professor_id: string;
  name: string;
  employee_code: string;
}

interface AuthState {
  user: ProfessorUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: ProfessorUser, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  getDeviceId: () => Promise<string>;
}

async function getOrCreateDeviceUUID(): Promise<string> {
  const key = 'smartattend_prof_device_uuid';
  let uuid = await SecureStore.getItemAsync(key);
  if (!uuid) {
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    await SecureStore.setItemAsync(key, uuid);
  }
  return uuid;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  deviceId: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('prof_access_token', accessToken);
    await SecureStore.setItemAsync('prof_refresh_token', refreshToken);
    await SecureStore.setItemAsync('prof_user', JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('prof_access_token');
    await SecureStore.deleteItemAsync('prof_refresh_token');
    await SecureStore.deleteItemAsync('prof_user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
  try {
    const [token, refresh, userStr] = await Promise.all([
      SecureStore.getItemAsync('prof_access_token'),
      SecureStore.getItemAsync('prof_refresh_token'),
      SecureStore.getItemAsync('prof_user'),
    ]);

    if (!token || !userStr) {
      set({ isLoading: false });
      return;
    }

    // Check if access token is expired
    const isExpired = (t: string) => {
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        return payload.exp * 1000 < Date.now();
      } catch { return true; }
    };

    if (isExpired(token)) {
      // Try to refresh
      if (refresh && !isExpired(refresh)) {
        try {
          const axios = (await require('axios')).default;
          const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.201.59.185:4000/api';
          const user = JSON.parse(userStr);
          const res = await axios.post(`${API_BASE}/auth/refresh`, {
            user_id: user.user_id,
            refresh_token: refresh,
          });
          const { access_token, refresh_token } = res.data.data;
          await SecureStore.setItemAsync('prof_access_token', access_token);
          await SecureStore.setItemAsync('prof_refresh_token', refresh_token);
          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            user,
            isAuthenticated: true,
          });
          return;
        } catch {
          // Refresh failed — force logout
        }
      }
      // Both tokens expired — clear and force login
      await SecureStore.deleteItemAsync('prof_access_token');
      await SecureStore.deleteItemAsync('prof_refresh_token');
      await SecureStore.deleteItemAsync('prof_user');
      set({ isAuthenticated: false });
      return;
    }

    // Token still valid
    set({
      accessToken: token,
      refreshToken: refresh,
      user: JSON.parse(userStr),
      isAuthenticated: true,
    });
  } catch {
    set({ isAuthenticated: false });
  } finally {
    set({ isLoading: false });
  }
},

  getDeviceId: async () => {
    const { deviceId } = get();
    if (deviceId) return deviceId;
    const uuid = await getOrCreateDeviceUUID();
    set({ deviceId: uuid });
    return uuid;
  },
}));
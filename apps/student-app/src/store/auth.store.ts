import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { createHash } from 'crypto'; // expo-crypto alternative below
import { Platform } from 'react-native';
import Constants from 'expo-constants';

interface User {
  user_id: string;
  email: string;
  role: string;
  college_id: string;
  student_id: string;
  name: string;
  roll_number: string;
  semester: number;
  face_enrolled_at: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  getDeviceId: () => Promise<string>;
  updateFaceEnrolled: (enrolledAt: string) => void;
}

// Generate or retrieve stable installation UUID
async function getOrCreateDeviceUUID(): Promise<string> {
  const key = 'smartattend_device_uuid';
  let uuid = await SecureStore.getItemAsync(key);

  if (!uuid) {
    // Generate UUID v4
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
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
  try {
    const [token, refresh, userStr] = await Promise.all([
      SecureStore.getItemAsync('access_token'),
      SecureStore.getItemAsync('refresh_token'),
      SecureStore.getItemAsync('user'),
    ]);

    if (!token || !userStr) {
      set({ isLoading: false });
      return;
    }

    const isExpired = (t: string) => {
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        return payload.exp * 1000 < Date.now();
      } catch { return true; }
    };

    if (isExpired(token)) {
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
          await SecureStore.setItemAsync('access_token', access_token);
          await SecureStore.setItemAsync('refresh_token', refresh_token);
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
      // Both expired — clear storage and go to login
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await SecureStore.deleteItemAsync('user');
      set({ isAuthenticated: false });
      return;
    }

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

  updateFaceEnrolled: (enrolledAt) => {
    const { user } = get();
    if (user) {
      const updated = { ...user, face_enrolled_at: enrolledAt };
      set({ user: updated });
      SecureStore.setItemAsync('user', JSON.stringify(updated));
    }
  },
}));
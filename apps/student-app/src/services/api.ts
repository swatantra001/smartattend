import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
// import { API_BASE_URL } from '../constants';
import { useAuthStore } from '../store/auth.store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://51.20.16.157:4000/api';

// ── Create axios instance ──────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': Platform.OS,
    'X-Device-Model': Constants.deviceName || 'unknown',
  },
});

// ── Request interceptor: attach auth + device headers ─────────────────────
api.interceptors.request.use(async (config) => {
  const store = useAuthStore.getState();

  // Attach JWT
  if (store.accessToken) {
    config.headers.Authorization = `Bearer ${store.accessToken}`;
  }

  // Attach device ID (raw UUID — server hashes it)
  const deviceId = await store.getDeviceId();
  config.headers['X-Device-ID'] = deviceId;

  // Attach FCM token if available
  const fcmToken = await SecureStore.getItemAsync('fcm_token');
  if (fcmToken) {
    config.headers['X-FCM-Token'] = fcmToken;
  }

  return config;
});

// ── Response interceptor: handle token refresh ────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;

      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;

      try {
        const store = useAuthStore.getState();
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          user_id: store.user?.user_id,
          refresh_token: store.refreshToken,
        });

        const { access_token, refresh_token } = response.data.data;
        await SecureStore.setItemAsync('access_token', access_token);
        await SecureStore.setItemAsync('refresh_token', refresh_token);
        useAuthStore.setState({ accessToken: access_token, refreshToken: refresh_token });

        refreshQueue.forEach((cb) => cb(access_token));
        refreshQueue = [];

        original.headers = { ...original.headers, Authorization: `Bearer ${access_token}` };
        return api(original);
      } catch {
        await useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ── Typed API calls ───────────────────────────────────────────────────────
export const AuthAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: any) =>
    api.post('/auth/register/student', data),

  logout: (userId: string) =>
    api.post('/auth/logout', { user_id: userId }),
};

export const StudentAPI = {
  getProfile: () => api.get('/students/me'),
  getMyCourses: () => api.get('/students/courses'),
  getEnrollmentStatus: () => api.get('/students/enrollment-status'),

  enrollFace: (photos: string[], metaData?: Object[]) =>
    api.post('/students/enroll-face', { photos }),

  requestDeviceReset: (data: {
    reason: string;
    new_device_id_raw: string;
    proof_base64?: string;
  }) => api.post('/students/device-reset-request', data),
  // ── NEW: Request Face Reset ──
  requestFaceReset: (data: { reason: string }) =>
    api.post('/students/face-reset-request', data),

  getDeviceResetStatus: () => api.get('/students/device-reset-status'),

  getNearbyActiveSession: (lat: number, lng: number) =>
    api.get('/sessions/nearby', { params: { lat, lng } }),

  pingLocation: (lat: number, lng: number, accuracy?: number) =>
    api.post('/location/ping', { lat, lng, accuracy }),

  // ── NEW: Fetch last location ──
  getLastLocation: () => api.get('/students/last-location'),
  // GET /student/courses/:courseId/attendance-calendar
  // Returns: { data: Record<"YYYY-MM-DD", "PRESENT" | "ABSENT"> }
  // Used by: CourseCalendarModal in home.tsx
  // AFTER:
  getCourseAttendanceCalendar: (courseId: string) =>
    api.get(`/students/courses/${courseId}/attendance-calendar`),
};

export const LocationAPI = {
  ping: (lat: number, lng: number, accuracy?: number) =>
    api.post('/location/ping', { lat, lng, accuracy }),
};

export const AttendanceAPI = {
  verify: (data: {
    session_id: string;
    face_frame_base64: string;
    liveness_result: {
      challenges_completed: string[];
      scores: Record<string, number>;
      composite_score: number;
    };
  }) => api.post('/attendance/verify', data),

  getMyStatus: (sessionId: string) =>
    api.get(`/attendance/session/${sessionId}/status`),

  getHistory: () => api.get('/attendance/history'),
};




// ── Assignments (Student) ──────────────────────────────────────────────────
export const AssignmentAPI = {
  // Fetch all assignments for a specific course
  getCourseAssignments: (courseId: string) => 
    api.get(`/courses/${courseId}/assignments`),

  // Fetch specific assignment details and the student's submission status
  getAssignmentDetails: (assignmentId: string) => 
    api.get(`/assignments/${assignmentId}`),

  // Upload solution files (Requires FormData for multipart/form-data)
  submitAssignment: (assignmentId: string, formData: FormData) => 
    api.post(`/assignments/${assignmentId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Delete/Detach a submission
  detachSubmission: (assignmentId: string) => 
    api.delete(`/assignments/${assignmentId}/submit`),
  // Add this inside export const AssignmentAPI = { ... }
  deleteIndividualFile: (assignmentId: string, fileUrl: string) => 
    api.delete(`/assignments/${assignmentId}/files`, { data: { file_url: fileUrl } }),
};
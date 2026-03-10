

import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/auth.store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.201.59.185:4000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': Platform.OS,
    'X-Device-Model': Constants.deviceName || 'unknown',
  },
});

api.interceptors.request.use(async (config) => {
  const store = useAuthStore.getState();
  if (store.accessToken) {
    config.headers.Authorization = `Bearer ${store.accessToken}`;
  }
  const deviceId = await store.getDeviceId();
  config.headers['X-Device-ID'] = deviceId;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const store = useAuthStore.getState();
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          user_id: store.user?.user_id,
          refresh_token: store.refreshToken,
        });
        const { access_token, refresh_token } = res.data.data;
        await SecureStore.setItemAsync('prof_access_token', access_token);
        await SecureStore.setItemAsync('prof_refresh_token', refresh_token);
        useAuthStore.setState({ accessToken: access_token, refreshToken: refresh_token });
        refreshQueue.forEach((cb) => cb(access_token));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${access_token}`;
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

export const AuthAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  logout: (userId: string) => api.post('/auth/logout', { user_id: userId }),
};

export const ProfessorAPI = {
  // ── Courses ────────────────────────────────────────────────────────────────
  // Professor's currently assigned courses (shown on home screen)
  getCourses: () => api.get('/professors/courses'),

  // All available courses in the college to self-assign
  getAvailableCourses: () => api.get('/professors/available-courses'),

  // Self-assign a course
  assignCourse: (courseId: string) =>
    api.post('/professors/assign-course', { course_id: courseId }),

  // Remove self from a course
  unassignCourse: (courseId: string) =>
    api.delete(`/professors/unassign-course/${courseId}`),

  // ── Sessions ───────────────────────────────────────────────────────────────
  startSession: (data: {
    course_id: string;
    lat: number;
    lng: number;
    radius_meters?: number;
    class_duration_minutes?: number;
  }) => api.post('/sessions/start', data),

  endSession: (sessionId: string) => api.post(`/sessions/${sessionId}/end`),
  deleteSession: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
  bulkDeleteSessions: (sessionIds: string[]) => api.post('/sessions/bulk-delete', { session_ids: sessionIds }),
  cancelSession: (sessionId: string) => api.post(`/sessions/${sessionId}/cancel`),

  getActiveSession: () => api.get('/sessions/professor/active'),
  getDashboard: (sessionId: string) => api.get(`/sessions/${sessionId}/dashboard`),

  manualOverride: (
    sessionId: string,
    studentId: string,
    status: 'PRESENT' | 'ABSENT',
    reason: string
  ) => api.patch(`/sessions/${sessionId}/students/${studentId}/override`, { status, reason }),

  // ── Reports ────────────────────────────────────────────────────────────────
  getCourseReport: (courseId: string) => api.get(`/attendance/course/${courseId}/report`),

  // ── Student enrollment management ─────────────────────────────────────────
  searchStudentsForEnrollment: (courseId: string, q: string) =>
    api.get(`/professors/courses/${courseId}/search-students`, { params: { q } }),

  getCourseStudents: (courseId: string) =>
    api.get(`/professors/courses/${courseId}/students`),

  enrollStudents: (courseId: string, roll_numbers: string[]) =>
    api.post(`/professors/courses/${courseId}/enroll`, { roll_numbers }),

  removeStudentFromCourse: (courseId: string, studentId: string) =>
    api.delete(`/professors/courses/${courseId}/students/${studentId}`),

  // ADD inside ProfessorAPI object:

  previewStudentsInRange: (data: {
    course_id: string;
    lat: number;
    lng: number;
    radius_meters: number;
  }) => api.post('/sessions/preview-students', data),

  // Add inside ProfessorAPI object:
  getCourseSessions: (courseId: string) =>
    api.get(`/sessions/course/${courseId}`),

  getSessionRoster: (sessionId: string) =>
    api.get(`/sessions/${sessionId}/roster`),

  // In api.ts, ProfessorAPI — the override call already exists as manualOverride,
  // but session.tsx calls overrideAttendance. Add this alias:
  overrideAttendance: (sessionId: string, data: {
    student_id: string;
    status: 'PRESENT' | 'ABSENT';
    override_reason: string;
  }) => api.patch(`/sessions/${sessionId}/students/${data.student_id}/override`, {
    status: data.status,
    reason: data.override_reason,
  }),
};
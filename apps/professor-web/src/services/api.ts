import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
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
        useAuthStore.setState({ accessToken: access_token, refreshToken: refresh_token });
        localStorage.setItem('prof_access', access_token);
        localStorage.setItem('prof_refresh', refresh_token);
        refreshQueue.forEach((cb) => cb(access_token));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
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
//   login: (email: string, password: string) => api.post('/auth/login', { email, password }),
//   forgotPassword: (identifier: string) => api.post('/auth/forgot-password', { identifier }),
//   resetPassword: (identifier: string, otp: string, new_password: string) =>
//     api.post('/auth/reset-password', { identifier, otp, new_password }),

login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  // ─── Add these two methods to your existing AuthAPI object ───────────────────
  // File: src/services/api.ts  (wherever AuthAPI is defined)

  // POST /api/auth/forgot-password
  // Body: { identifier: string }  ← email / roll_number / employee_code
  // Response: { success: true, message: string }  (always generic to prevent enumeration)
  forgotPassword: (body: { identifier: string }) => {
    api.post('/auth/forgot-password', body); console.log('Forgot password API called with body:', body);
  },

  // POST /api/auth/reset-password
  // Body: { identifier: string, otp: string, new_password: string }
  // Response: { success: true, message: string }
  // Error codes: INVALID_OTP | OTP_EXPIRED | WEAK_PASSWORD | NOT_FOUND
  resetPassword: (body: { identifier: string; otp: string; new_password: string }) =>
    api.post('/auth/reset-password', body),

  logout: (userId: string) => api.post('/auth/logout', { user_id: userId }),
};

export const ProfAPI = {
  // Courses
  getCourses: () => api.get('/professors/courses'),
  getAvailableCourses: () => api.get('/professors/available-courses'),
  assignCourse: (course_id: string) => api.post('/professors/assign-course', { course_id }),
  unassignCourse: (courseId: string) => api.delete(`/professors/unassign-course/${courseId}`),
  getCourseStudents: (courseId: string) => api.get(`/professors/courses/${courseId}/students`),
  searchStudents: (courseId: string, q: string) =>
    api.get(`/professors/courses/${courseId}/search-students`, { params: { q } }),
  enrollStudents: (courseId: string, roll_numbers: string[]) =>
    api.post(`/professors/courses/${courseId}/enroll`, { roll_numbers }),
  removeStudent: (courseId: string, studentId: string) =>
    api.delete(`/professors/courses/${courseId}/students/${studentId}`),

  // Sessions
  startSession: (data: {
    course_id: string; lat: number; lng: number;
    radius_meters?: number; class_duration_minutes?: number;
  }) => api.post('/sessions/start', data),
  endSession: (sessionId: string) => api.post(`/sessions/${sessionId}/end`),
  cancelSession: (sessionId: string) => api.post(`/sessions/${sessionId}/cancel`),
  deleteSession: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
  bulkDeleteSessions: (ids: string[]) => api.post('/sessions/bulk-delete', { session_ids: ids }),
  getActiveSession: () => api.get('/sessions/professor/active'),
  getDashboard: (sessionId: string) => api.get(`/sessions/${sessionId}/dashboard`),
  manualOverride: (sessionId: string, studentId: string, status: string, reason: string) =>
    api.patch(`/sessions/${sessionId}/students/${studentId}/override`, { status, reason }),
  previewStudents: (data: {
    course_id: string; lat: number; lng: number; radius_meters: number;
  }) => api.post('/sessions/preview-students', data),
  getCourseSessions: (courseId: string) => api.get(`/sessions/course/${courseId}`),
  getSessionRoster: (sessionId: string) => api.get(`/sessions/${sessionId}/roster`),

  // Reports
  getCourseReport: (courseId: string) => api.get(`/attendance/course/${courseId}/report`),

  // Assignments
  getCourseAssignments: (courseId: string) => api.get(`/courses/${courseId}/assignments`),
  createAssignment: (courseId: string, data: object) =>
    api.post(`/courses/${courseId}/assignments`, data,  {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAssignmentDetails: (assignmentId: string) => api.get(`/assignments/${assignmentId}`),
  updateAssignment: (assignmentId: string, formData: FormData) =>
    api.put(`/assignments/${assignmentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  evaluateAssignment: (assignmentId: string) =>
    api.post(`/assignments/${assignmentId}/evaluate`, {}, { timeout: 300000 }),
  evaluateEntireCourse: (courseId: string) =>
    api.post(`/courses/${courseId}/evaluate-all`, {}, { timeout: 300000 }),
  getEvaluationReport: (assignmentId: string) => api.get(`/assignments/${assignmentId}/report`),
  flagCluster: (clusterId: string, reason: string) =>
    api.post(`/assignments/clusters/${clusterId}/flag`, { reason }),
  getEvaluationProgress: (assignmentId: string) =>
    api.get(`/assignments/${assignmentId}/progress`),
};
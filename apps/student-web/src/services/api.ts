import axios from 'axios';
import { API_BASE_URL } from '../constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
headers: { 
    'Content-Type': 'application/json',
    'X-Platform': 'web' // 👈 ADD THIS LINE
  },
  withCredentials: true,
});
// Inject Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('st_access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  r => r,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !orig._retry) {
      orig._retry = true;
      try {
        const refresh = localStorage.getItem('st_refresh');
        const user = JSON.parse(localStorage.getItem('st_user') || '{}');
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refresh,
          user_id: user.user_id,
        });
        const { access_token, refresh_token } = res.data.data;
        localStorage.setItem('st_access', access_token);
        localStorage.setItem('st_refresh', refresh_token);
        orig.headers.Authorization = `Bearer ${access_token}`;
        return api(orig);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const AuthAPI = {
//   login:         (email: string, password: string) =>
//     api.post('/auth/login', { email, password }),
//   forgotPassword:(identifier: string) =>
//     api.post('/auth/forgot-password', { identifier }),
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


  logout:        (user_id: string) =>
	api.post('/auth/logout', { user_id }),
};

// ── Student profile / enrollment ─────────────────────────────────────────────
export const StudentAPI = {
  getProfile:          () => api.get('/students/me'),
  getEnrollmentStatus: () => api.get('/students/enrollment-status'),
  getMyCourses:        () => api.get('/students/courses'),
  getLastLocation:     () => api.get('/students/last-location'),
  requestDeviceReset:  (reason: string) =>
    api.post('/students/device-reset-request', { reason }),
  getDeviceResetStatus:() => api.get('/students/device-reset-status'),
  requestFaceReset:    () => api.post('/students/face-reset-request'),
  pingLocation:        (lat: number, lng: number, accuracy?: number) =>
    api.post('/location/ping', { lat, lng, accuracy }),
  getCourseCalendar:   (courseId: string) =>
    api.get(`/students/courses/${courseId}/attendance-calendar`),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const AttendanceAPI = {
  getNearbySession:    (lat: number, lng: number) =>
    api.get('/sessions/nearby', { params: { lat, lng } }),
  verifyAttendance:    (payload: {
    session_id: string;
    face_frame_base64: string;
    liveness_result: {
      challenges_completed: string[];
      scores: Record<string, number>;
      composite_score: number;
    };
  }) => api.post('/attendance/verify', payload),
  getMyStatus:         (sessionId: string) =>
    api.get(`/attendance/session/${sessionId}/status`),
  getHistory:          () => api.get('/attendance/history'),
};

// ── Assignments ───────────────────────────────────────────────────────────────
export const AssignmentAPI = {
  getCourseAssignments: (courseId: string) =>
    api.get(`/courses/${courseId}/assignments`),
  getAssignmentDetails: (assignmentId: string) =>
    api.get(`/assignments/${assignmentId}`),
  submitAssignment:     (assignmentId: string, files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return api.post(`/assignments/${assignmentId}/submit`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteSubmission:     (assignmentId: string) =>
    api.delete(`/assignments/${assignmentId}/submit`),
  deleteFile:           (assignmentId: string, file_url: string) =>
    api.delete(`/assignments/${assignmentId}/files`, { data: { file_url } }),
};

export default api;
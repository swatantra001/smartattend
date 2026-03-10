// import axios from 'axios';
// import { API_BASE_URL } from '../constants';
// import { useAuthStore } from '../store/auth.store';

// const api = axios.create({
//   baseURL: API_BASE_URL,
//   timeout: 20000,
//   headers: { 'Content-Type': 'application/json' },
// });

// api.interceptors.request.use((config) => {
//   const token = useAuthStore.getState().accessToken;
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// api.interceptors.response.use(
//   (r) => r,
//   (err) => {
//     if (err.response?.status === 401) {
//       useAuthStore.getState().clearAuth();
//       window.location.href = '/login';
//     }
//     return Promise.reject(err);
//   }
// );

// export default api;

// // ── Auth ──────────────────────────────────────────────────────────────────
// export const AuthAPI = {
//   login: (email: string, password: string) =>
//     api.post('/auth/login', { email, password }),
// };

// // ── Admin ─────────────────────────────────────────────────────────────────
// export const AdminAPI = {
//   // Device resets
//   listDeviceResets: (status = 'PENDING') =>
//     api.get(`/admin/device-resets?status=${status}`),
//   approveReset: (requestId: string) =>
//     api.post(`/admin/device-resets/${requestId}/approve`),
//   rejectReset: (requestId: string, admin_note: string) =>
//     api.post(`/admin/device-resets/${requestId}/reject`, { admin_note }),

//   // Students
//   listStudents: (page = 1, search = '') =>
//     api.get(`/admin/students?page=${page}&limit=50&search=${search}`),
//   deactivateStudent: (studentId: string) =>
//     api.patch(`/admin/students/${studentId}/deactivate`),
//   activateStudent: (studentId: string) =>
//     api.patch(`/admin/students/${studentId}/activate`),
//   resetFaceEnrollment: (studentId: string) =>
//     api.delete(`/admin/students/${studentId}/face-enrollment`),

//   // Professors
//   listProfessors: () => api.get('/admin/professors'),

//   // Departments
//   listDepartments: () => api.get('/admin/departments'),
//   createDepartment: (data: { name: string; code: string }) =>
//     api.post('/admin/departments', data),

//   // Courses
//   createCourse: (data: any) => api.post('/admin/courses', data),
//   enrollStudents: (courseId: string, data: any) =>
//     api.post(`/admin/courses/${courseId}/enroll`, data),

//   // Reports
//   getAttendanceReport: (params: Record<string, string>) =>
//     api.get('/admin/reports/attendance', { params }),

//   // Audit
//   getAuditLogs: (page = 1, action = '') =>
//     api.get(`/admin/audit-logs?page=${page}&limit=100&action=${action}`),
// };


















// D:\smartattend\apps\admin-web\src\services\api.ts
// FULL REPLACEMENT — adds all new endpoints

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const AuthAPI = {
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
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const AdminAPI = {
  // Students
  listStudents: (page = 1, search = '') =>
    api.get(`/admin/students?page=${page}&limit=50&search=${search}`),

  preRegisterStudent: (data: {
    email: string; roll_number: string; name: string; dept_id: string; semester: number;
  }) => api.post('/admin/students/pre-register', data),

  bulkImportStudents: (students: any[]) =>
    api.post('/admin/students/bulk-import', { students }),

  deactivateStudent: (studentId: string) =>
    api.patch(`/admin/students/${studentId}/deactivate`),

  activateStudent: (studentId: string) =>
    api.patch(`/admin/students/${studentId}/activate`),

  resetFaceEnrollment: (studentId: string) =>
    api.delete(`/admin/students/${studentId}/face-enrollment`),

  // Professors
  listProfessors: () => api.get('/admin/professors'),

  preRegisterProfessor: (data: {
    email: string; name: string; employee_code: string; dept_id: string;
  }) => api.post('/admin/professors/pre-register', data),

  bulkImportProfessors: (professors: any[]) =>
    api.post('/admin/professors/bulk-import', { professors }),

  // Departments
  listDepartments: () => api.get('/admin/departments'),
  createDepartment: (data: { name: string; code: string }) =>
    api.post('/admin/departments', data),

  // Courses
  listCourses: () => api.get('/admin/courses'),
  createCourse: (data: any) => api.post('/admin/courses', data),

  enrollStudents: (courseId: string, data: { professor_id: string; student_ids: string[] }) =>
    api.post(`/admin/courses/${courseId}/enroll`, data),

  enrollByRollNumbers: (courseId: string, data: { professor_id: string; roll_numbers: string[] }) =>
    api.post(`/admin/courses/${courseId}/enroll-by-rolls`, data),

  // Device resets
  listDeviceResets: (status = 'PENDING') =>
    api.get(`/admin/device-resets?status=${status}`),
  approveReset: (requestId: string) =>
    api.post(`/admin/device-resets/${requestId}/approve`),
  rejectReset: (requestId: string, admin_note: string) =>
    api.post(`/admin/device-resets/${requestId}/reject`, { admin_note }),


  // Inside AdminAPI object:
  listFaceResets: (status: string) => api.get(`/admin/face-resets?status=${status}`),
  approveFaceReset: (requestId: string) => api.post(`/admin/face-resets/${requestId}/approve`),
  rejectFaceReset: (requestId: string, reason: string) => api.post(`/admin/face-resets/${requestId}/reject`, { reason }),

  // Reports
  getAttendanceReport: (params: Record<string, string>) =>
    api.get('/admin/reports/attendance', { params }),

  // Audit
  getAuditLogs: (page = 1, action = '') =>
    api.get(`/admin/audit-logs?page=${page}&limit=100&action=${action}`),

  // ─── Add these two methods to your AdminAPI object in services/api.ts ────────

  // PATCH /api/admin/professors/:professorId
  updateProfessor: (professorId: string, data: {
    name?: string;
    employee_code?: string;
    dept_id?: string;
    email?: string;
  }) => api.patch(`/admin/professors/${professorId}`, data),

  // DELETE /api/admin/professors/:professorId
  deleteProfessor: (professorId: string) =>
    api.delete(`/admin/professors/${professorId}`),

  updateStudent: (studentId: string, data: {
    name?: string; roll_number?: string; dept_id?: string;
    semester?: number; email?: string;
  }) => api.patch(`/admin/students/${studentId}`, data),

  adminClearDeviceBinding: (studentId: string) =>
    api.delete(`/admin/students/${studentId}/device-binding`),

  getCourseDetail: (courseId: string) =>
    api.get(`/admin/courses/${courseId}/detail`),

  updateCourse: (courseId: string, data: {
    name?: string; code?: string; section?: string | null;
    dept_id?: string; semester?: number;
  }) => api.patch(`/admin/courses/${courseId}`, data),

  deleteCourse: (courseId: string) =>
    api.delete(`/admin/courses/${courseId}`),

  bulkImportCourses: (rows: Array<{
    name: string; code: string; dept_id: string; semester: number; section?: string;
  }>) => api.post('/admin/courses/bulk-import', rows),

  getDepartmentDetail: (deptId: string) =>
    api.get(`/admin/departments/${deptId}/detail`),

  updateDepartment: (deptId: string, data: { name?: string; code?: string }) =>
    api.patch(`/admin/departments/${deptId}`, data),

  deleteDepartment: (deptId: string) =>
    api.delete(`/admin/departments/${deptId}`),

  bulkImportDepartments: (rows: Array<{ name: string; code: string }>) =>
    api.post('/admin/departments/bulk-import', rows),

};


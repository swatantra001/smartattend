

// import { Router } from 'express';
// import { asyncHandler } from '../middleware/error.middleware';
// import { authenticate, requireRole } from '../middleware/auth.middleware';
// import { auditLog } from '../middleware/audit.middleware';
// import * as AdminController from '../controllers/admin.controller';
// import { db } from 'src/config/database';

// const router = Router();

// router.use(authenticate);
// router.use(requireRole('ADMIN'));

// // Quick admin route — add to admin.routes.ts // TODO: delete in production
// router.delete('/admin/device-binding/:userId', authenticate, requireRole('ADMIN'), 
//   async (req, res) => {
//     await db.query('DELETE FROM device_bindings WHERE user_id = $1', [req.params.userId]);
//     res.json({ success: true, message: 'Device binding cleared' });
//   }
// );

// // ─── STUDENTS ─────────────────────────────────────────────────────────────────
// router.get('/students', asyncHandler(AdminController.listStudents));

// // Pre-register a single student (admin fills in the form)
// router.post(
//   '/students/pre-register',
//   auditLog('STUDENT_PRE_REGISTERED'),
//   asyncHandler(AdminController.preRegisterStudent)
// );

// // Bulk import from CSV/Excel/JSON (frontend parses file → sends JSON array)
// router.post(
//   '/students/bulk-import',
//   auditLog('STUDENTS_BULK_IMPORTED'),
//   asyncHandler(AdminController.bulkImportStudents)
// );

// router.patch(
//   '/students/:studentId/deactivate',
//   auditLog('STUDENT_DEACTIVATED'),
//   asyncHandler(AdminController.deactivateStudent)
// );

// router.patch(
//   '/students/:studentId/activate',
//   auditLog('STUDENT_ACTIVATED'),
//   asyncHandler(AdminController.activateStudent)
// );

// router.delete(
//   '/students/:studentId/face-enrollment',
//   auditLog('FACE_ENROLLMENT_RESET'),
//   asyncHandler(AdminController.resetFaceEnrollment)
// );

// // ─── PROFESSORS ───────────────────────────────────────────────────────────────
// router.get('/professors', asyncHandler(AdminController.listProfessors));

// router.post(
//   '/professors/pre-register',
//   auditLog('PROFESSOR_PRE_REGISTERED'),
//   asyncHandler(AdminController.preRegisterProfessor)
// );

// router.post(
//   '/professors/bulk-import',
//   auditLog('PROFESSORS_BULK_IMPORTED'),
//   asyncHandler(AdminController.bulkImportProfessors)
// );

// // ─── COURSES ─────────────────────────────────────────────────────────────────
// router.get('/courses', asyncHandler(AdminController.listCourses));

// router.post(
//   '/courses',
//   auditLog('COURSE_CREATED'),
//   asyncHandler(AdminController.createCourse)
// );

// // Enroll by student UUIDs
// router.post(
//   '/courses/:courseId/enroll',
//   auditLog('STUDENTS_ENROLLED'),
//   asyncHandler(AdminController.enrollStudents)
// );

// // Enroll by roll numbers — returns list of not-found rolls
// router.post(
//   '/courses/:courseId/enroll-by-rolls',
//   auditLog('STUDENTS_ENROLLED_BY_ROLLS'),
//   asyncHandler(AdminController.enrollByRollNumbers)
// );

// // ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
// router.get('/departments', asyncHandler(AdminController.listDepartments));

// router.post(
//   '/departments',
//   auditLog('DEPARTMENT_CREATED'),
//   asyncHandler(AdminController.createDepartment)
// );

// // ─── DEVICE RESETS ────────────────────────────────────────────────────────────
// router.get('/device-resets', asyncHandler(AdminController.listDeviceResetRequests));

// router.post(
//   '/device-resets/:requestId/approve',
//   auditLog('DEVICE_RESET_APPROVED'),
//   asyncHandler(AdminController.approveDeviceReset)
// );

// router.post(
//   '/device-resets/:requestId/reject',
//   auditLog('DEVICE_RESET_REJECTED'),
//   asyncHandler(AdminController.rejectDeviceReset)
// );
// router.get('/face-resets', asyncHandler(AdminController.listFaceResets));
// router.post('/face-resets/:requestId/approve', asyncHandler(AdminController.approveFaceReset));
// router.post('/face-resets/:requestId/reject', asyncHandler(AdminController.rejectFaceReset));
// // ─── REPORTS ─────────────────────────────────────────────────────────────────
// router.get('/reports/attendance', asyncHandler(AdminController.getAttendanceReport));

// // ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
// router.get('/audit-logs', asyncHandler(AdminController.getAuditLogs));

// export default router;







// D:\smartattend\services\api\src\routes\admin.routes.ts

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';
import * as AdminController from '../controllers/admin.controller';
import { db } from 'src/config/database';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN'));

// Quick admin route — TODO: delete in production
router.delete('/admin/device-binding/:userId', authenticate, requireRole('ADMIN'),
  async (req, res) => {
    await db.query('DELETE FROM device_bindings WHERE user_id = $1', [req.params.userId]);
    res.json({ success: true, message: 'Device binding cleared' });
  }
);

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
router.get('/students', asyncHandler(AdminController.listStudents));

router.post(
  '/students/pre-register',
  auditLog('STUDENT_PRE_REGISTERED'),
  asyncHandler(AdminController.preRegisterStudent)
);

router.post(
  '/students/bulk-import',
  auditLog('STUDENTS_BULK_IMPORTED'),
  asyncHandler(AdminController.bulkImportStudents)
);

router.patch(
  '/students/:studentId/deactivate',
  auditLog('STUDENT_DEACTIVATED'),
  asyncHandler(AdminController.deactivateStudent)
);

router.patch(
  '/students/:studentId/activate',
  auditLog('STUDENT_ACTIVATED'),
  asyncHandler(AdminController.activateStudent)
);

router.delete(
  '/students/:studentId/face-enrollment',
  auditLog('FACE_ENROLLMENT_RESET'),
  asyncHandler(AdminController.resetFaceEnrollment)
);

// ─── PROFESSORS ───────────────────────────────────────────────────────────────
router.get('/professors', asyncHandler(AdminController.listProfessors));

router.post(
  '/professors/pre-register',
  auditLog('PROFESSOR_PRE_REGISTERED'),
  asyncHandler(AdminController.preRegisterProfessor)
);

router.post(
  '/professors/bulk-import',
  auditLog('PROFESSORS_BULK_IMPORTED'),
  asyncHandler(AdminController.bulkImportProfessors)
);

// PATCH /api/admin/professors/:professorId — edit name, employee_code, dept_id
router.patch(
  '/professors/:professorId',
  auditLog('PROFESSOR_UPDATED'),
  asyncHandler(AdminController.updateProfessor)
);

// DELETE /api/admin/professors/:professorId — remove professor (only if not yet registered)
router.delete(
  '/professors/:professorId',
  auditLog('PROFESSOR_DELETED'),
  asyncHandler(AdminController.deleteProfessor)
);

// ─── COURSES ─────────────────────────────────────────────────────────────────
router.get('/courses', asyncHandler(AdminController.listCourses));

router.post(
  '/courses',
  auditLog('COURSE_CREATED'),
  asyncHandler(AdminController.createCourse)
);

router.post(
  '/courses/:courseId/enroll',
  auditLog('STUDENTS_ENROLLED'),
  asyncHandler(AdminController.enrollStudents)
);

router.post(
  '/courses/:courseId/enroll-by-rolls',
  auditLog('STUDENTS_ENROLLED_BY_ROLLS'),
  asyncHandler(AdminController.enrollByRollNumbers)
);

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
router.get('/departments', asyncHandler(AdminController.listDepartments));

router.post(
  '/departments',
  auditLog('DEPARTMENT_CREATED'),
  asyncHandler(AdminController.createDepartment)
);

// ─── DEVICE RESETS ────────────────────────────────────────────────────────────
router.get('/device-resets', asyncHandler(AdminController.listDeviceResetRequests));

router.post(
  '/device-resets/:requestId/approve',
  auditLog('DEVICE_RESET_APPROVED'),
  asyncHandler(AdminController.approveDeviceReset)
);

router.post(
  '/device-resets/:requestId/reject',
  auditLog('DEVICE_RESET_REJECTED'),
  asyncHandler(AdminController.rejectDeviceReset)
);

router.get('/face-resets', asyncHandler(AdminController.listFaceResets));
router.post('/face-resets/:requestId/approve', asyncHandler(AdminController.approveFaceReset));
router.post('/face-resets/:requestId/reject', asyncHandler(AdminController.rejectFaceReset));

// ─── REPORTS ─────────────────────────────────────────────────────────────────
router.get('/reports/attendance', asyncHandler(AdminController.getAttendanceReport));

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
router.get('/audit-logs', asyncHandler(AdminController.getAuditLogs));

// ─────────────────────────────────────────────────────────────────────────────
// APPEND to admin.routes.ts — paste these before `export default router`
// ─────────────────────────────────────────────────────────────────────────────

// PATCH /api/admin/students/:studentId  — edit name, roll_number, dept_id, semester, pending_email
router.patch(
  '/students/:studentId',
  auditLog('STUDENT_UPDATED'),
  asyncHandler(AdminController.updateStudent)
);

// DELETE /api/admin/students/:studentId/device-binding  — admin force-clear device (no approval flow)
router.delete(
  '/students/:studentId/device-binding',
  auditLog('STUDENT_DEVICE_CLEARED'),
  asyncHandler(AdminController.adminClearStudentDevice)
);

// ─────────────────────────────────────────────────────────────────────────────
// APPEND to admin.routes.ts — paste these three blocks before `export default router`
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/admin/courses/:courseId/detail  — enrolled students + assigned professors
router.get(
  '/courses/:courseId/detail',
  asyncHandler(AdminController.getCourseDetail)
);

// PATCH /api/admin/courses/:courseId  — edit name, code, section, dept_id, semester
router.patch(
  '/courses/:courseId',
  auditLog('COURSE_UPDATED'),
  asyncHandler(AdminController.updateCourse)
);

// DELETE /api/admin/courses/:courseId  — soft-deactivate (sets is_active = false)
router.delete(
  '/courses/:courseId',
  auditLog('COURSE_DELETED'),
  asyncHandler(AdminController.deleteCourse)
);

// POST /api/admin/courses/bulk-import  — bulk create courses from array
router.post(
  '/courses/bulk-import',
  auditLog('COURSES_BULK_IMPORTED'),
  asyncHandler(AdminController.bulkImportCourses)
);

// ═══════════════════════════════════════════════════════════════════════════════
// FILE 1 — APPEND to admin.routes.ts
// Paste these lines before `export default router`
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/admin/departments/:deptId/detail  — courses + professors + students sample
router.get(
  '/departments/:deptId/detail',
  asyncHandler(AdminController.getDepartmentDetail)
);

// PATCH /api/admin/departments/:deptId  — edit name / code
router.patch(
  '/departments/:deptId',
  auditLog('DEPARTMENT_UPDATED'),
  asyncHandler(AdminController.updateDepartment)
);

// DELETE /api/admin/departments/:deptId  — hard delete (cascades in DB)
router.delete(
  '/departments/:deptId',
  auditLog('DEPARTMENT_DELETED'),
  asyncHandler(AdminController.deleteDepartment)
);

// POST /api/admin/departments/bulk-import  — bulk create from array
router.post(
  '/departments/bulk-import',
  auditLog('DEPARTMENTS_BULK_IMPORTED'),
  asyncHandler(AdminController.bulkImportDepartments)
);
export default router;
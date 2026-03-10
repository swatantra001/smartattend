


// D:\smartattend\services\api\src\routes\professor.routes.ts
// FULL REPLACEMENT — clean file, no duplicate imports

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { requireRole, authenticate } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';
import { db } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import * as ProfessorController from '../controllers/professor.controller';

const router = Router();

// ─── COURSE ASSIGNMENT (professor picks their own courses) ────────────────────

// GET /api/professors/available-courses
// Returns all active courses in the professor's department (and college)
// that have no professor assigned yet, OR that are assigned to this professor.
router.get(
  '/available-courses',
  requireRole('PROFESSOR'),
  asyncHandler(ProfessorController.getAvailableCourses)
);

// POST /api/professors/assign-course
// Professor self-assigns a course to themselves
// Body: { course_id: string }
router.post(
  '/assign-course',
  requireRole('PROFESSOR'),
  auditLog('COURSE_ASSIGNED'),
  asyncHandler(ProfessorController.assignCourse)
);

// DELETE /api/professors/unassign-course/:courseId
// Professor removes themselves from a course (only if no active session)
router.delete(
  '/unassign-course/:courseId',
  requireRole('PROFESSOR'),
  auditLog('COURSE_UNASSIGNED'),
  asyncHandler(ProfessorController.unassignCourse)
);

// ─── PROFESSOR'S ASSIGNED COURSES ─────────────────────────────────────────────

// GET /api/professors/courses — professor's currently assigned courses
router.get(
  '/courses',
  requireRole('PROFESSOR'),
  asyncHandler(ProfessorController.getProfessorCourses)
);

// ─── STUDENT ENROLLMENT MANAGEMENT ────────────────────────────────────────────

// GET /api/professors/courses/:courseId/search-students?q=roll_or_name
router.get(
  '/courses/:courseId/search-students',
  requireRole('PROFESSOR'),
  asyncHandler(ProfessorController.searchStudentsForEnrollment)
);

// GET /api/professors/courses/:courseId/students
router.get(
  '/courses/:courseId/students',
  requireRole('PROFESSOR'),
  asyncHandler(ProfessorController.getCourseStudents)
);

// POST /api/professors/courses/:courseId/enroll
// Body: { roll_numbers: string[] }
router.post(
  '/courses/:courseId/enroll',
  requireRole('PROFESSOR'),
  auditLog('STUDENTS_ENROLLED'),
  asyncHandler(ProfessorController.enrollStudents)
);

// DELETE /api/professors/courses/:courseId/students/:studentId
router.delete(
  '/courses/:courseId/students/:studentId',
  requireRole('PROFESSOR'),
  auditLog('STUDENT_REMOVED'),
  asyncHandler(ProfessorController.removeStudent)
);

export default router;
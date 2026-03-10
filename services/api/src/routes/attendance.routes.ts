import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';
import * as AttendanceController from '../controllers/attendance.controller';

const router = Router();

// POST /api/attendance/verify — student submits face frame for verification
router.post(
  '/verify',
  requireRole('STUDENT'),
  auditLog('FACE_VERIFY_ATTEMPT'),
  asyncHandler(AttendanceController.verifyAttendance)
);

// GET /api/attendance/session/:sessionId/status — student checks their status
router.get(
  '/session/:sessionId/status',
  requireRole('STUDENT'),
  asyncHandler(AttendanceController.getMyStatus)
);

// GET /api/attendance/history — student views their attendance history
router.get(
  '/history',
  requireRole('STUDENT'),
  asyncHandler(AttendanceController.getStudentHistory)
);

// GET /api/attendance/course/:courseId/report — professor views course report
router.get(
  '/course/:courseId/report',
  requireRole('PROFESSOR'),
  asyncHandler(AttendanceController.getCourseReport)
);

export default router;
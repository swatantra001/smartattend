

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { requireRole, authenticate } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';
import * as SessionController from '../controllers/session.controller';

const router = Router();

// All session routes require authentication (added)
router.use(authenticate);


// POST /api/sessions/start
router.post(
  '/start',
  requireRole('PROFESSOR'),
  auditLog('SESSION_START'),
  asyncHandler(SessionController.startSession)
);

// GET /api/sessions/professor/active
router.get(
  '/professor/active',
  requireRole('PROFESSOR'),
  asyncHandler(SessionController.getActiveSession)
);

// GET /api/sessions/professor/courses
// NOTE: getProfessorCourses must be exported from session.controller.ts
// See session.controller.additions.ts for the function to add
router.get(
  '/professor/courses',
  requireRole('PROFESSOR'),
  asyncHandler(SessionController.getProfessorCourses)
);

// GET /api/sessions/nearby?lat=&lng=
router.get(
  '/nearby',
  requireRole('STUDENT'),
  asyncHandler(SessionController.getNearbyActiveSession)
);


// DELETE /api/sessions/courses/:courseId
router.delete(
  '/courses/:courseId',
  requireRole('PROFESSOR'),
  auditLog('COURSE_DELETED'),
  asyncHandler(SessionController.deleteCourse)
);

// GET course sessions list
router.get(
  '/course/:courseId',
  requireRole('PROFESSOR'),
  asyncHandler(SessionController.getCourseSessionsList)
);
// GET session roster (all students + their status)
router.get(
  '/:sessionId/roster',
  requireRole('PROFESSOR'),
  asyncHandler(SessionController.getSessionRoster)
);

// POST /api/sessions/:sessionId/end
router.post(
  '/:sessionId/end',
  requireRole('PROFESSOR'),
  auditLog('SESSION_END'),
  asyncHandler(SessionController.endSession)
);

// POST /api/sessions/:sessionId/cancel
router.post(
  '/:sessionId/cancel',
  requireRole('PROFESSOR'),
  auditLog('SESSION_CANCELLED'),
  asyncHandler(SessionController.cancelSession)
);

// GET /api/sessions/:sessionId
router.get('/:sessionId', asyncHandler(SessionController.getSession));

router.delete('/:sessionId', requireRole('PROFESSOR'), asyncHandler(SessionController.deleteSession));
router.post('/bulk-delete', requireRole('PROFESSOR'), asyncHandler(SessionController.bulkDeleteSessions));
// GET /api/sessions/:sessionId/dashboard
router.get(
  '/:sessionId/dashboard',
  requireRole('PROFESSOR'),
  asyncHandler(SessionController.getDashboard)
);
// PATCH /api/sessions/:sessionId/students/:studentId/override
router.patch(
  '/:sessionId/students/:studentId/override',
  requireRole('PROFESSOR'),
  auditLog('MANUAL_OVERRIDE'),
  asyncHandler(SessionController.manualOverride)
);

// ADD before the /:sessionId routes (to avoid param conflicts):

// POST /api/sessions/preview-students
router.post(
  '/preview-students',
  requireRole('PROFESSOR'),
  asyncHandler(SessionController.previewStudentsInRange)
);


export default router;
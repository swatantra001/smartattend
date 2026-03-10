// import { Router } from 'express';
// import { asyncHandler } from '../middleware/error.middleware';
// import { requireRole } from '../middleware/auth.middleware';
// import { auditLog } from '../middleware/audit.middleware';
// import * as SessionController from '../controllers/session.controller';

// const router = Router();
// // deviceBindingMiddleware + authenticate already applied globally

// // POST /api/sessions/start — professor starts attendance session
// router.post(
//   '/start',
//   requireRole('PROFESSOR'),
//   auditLog('SESSION_START'),
//   asyncHandler(SessionController.startSession)
// );
// // GET /api/sessions/professor/active — professor's current active session
// router.get(
//   '/professor/active',
//   requireRole('PROFESSOR'),
//   asyncHandler(SessionController.getActiveSession)
// );

// // GET /api/sessions/nearby?lat=25.76&lng=82.59
// // Student checks if any active session is happening within 200m of them
// router.get(
//   '/nearby',
//   requireRole('STUDENT'),
//   asyncHandler(SessionController.getNearbyActiveSession)
// );

// // POST /api/sessions/:sessionId/end — professor ends session
// router.post(
//   '/:sessionId/end',
//   requireRole('PROFESSOR'),
//   auditLog('SESSION_END'),
//   asyncHandler(SessionController.endSession)
// );

// // GET /api/sessions/:sessionId — get session info + dashboard data
// router.get(
//   '/:sessionId',
//   asyncHandler(SessionController.getSession)
// );


// // PATCH /api/sessions/:sessionId/students/:studentId/override — manual override
// router.patch(
//   '/:sessionId/students/:studentId/override',
//   requireRole('PROFESSOR'),
//   auditLog('MANUAL_OVERRIDE'),
//   asyncHandler(SessionController.manualOverride)
// );

// // GET /api/sessions/:sessionId/dashboard — full dashboard student cards
// router.get(
//   '/:sessionId/dashboard',
//   requireRole('PROFESSOR'),
//   asyncHandler(SessionController.getDashboard)
// );



// export default router;




















// // D:\smartattend\services\api\src\routes\session.routes.ts
// // FULL REPLACEMENT

// import { Router } from 'express';
// import { asyncHandler } from '../middleware/error.middleware';
// import { requireRole } from '../middleware/auth.middleware';
// import { auditLog } from '../middleware/audit.middleware';
// import * as SessionController from '../controllers/session.controller';

// const router = Router();

// // POST /api/sessions/start
// router.post(
//   '/start',
//   requireRole('PROFESSOR'),
//   auditLog('SESSION_START'),
//   asyncHandler(SessionController.startSession)
// );

// // GET /api/sessions/professor/active
// router.get(
//   '/professor/active',
//   requireRole('PROFESSOR'),
//   asyncHandler(SessionController.getActiveSession)
// );

// // GET /api/sessions/professor/courses
// router.get(
//   '/professor/courses',
//   requireRole('PROFESSOR'),
//   asyncHandler(SessionController.getProfessorCourses)
// );

// // GET /api/sessions/nearby?lat=&lng=
// router.get(
//   '/nearby',
//   requireRole('STUDENT'),
//   asyncHandler(SessionController.getNearbyActiveSession)
// );

// // POST /api/sessions/:sessionId/end
// router.post(
//   '/:sessionId/end',
//   requireRole('PROFESSOR'),
//   auditLog('SESSION_END'),
//   asyncHandler(SessionController.endSession)
// );

// // POST /api/sessions/:sessionId/cancel  — no attendance recorded
// router.post(
//   '/:sessionId/cancel',
//   requireRole('PROFESSOR'),
//   auditLog('SESSION_CANCELLED'),
//   asyncHandler(SessionController.cancelSession)
// );

// // PATCH /api/sessions/:sessionId/students/:studentId/override
// // Works during AND after session for professor (physical verification, student appeal)
// router.patch(
//   '/:sessionId/students/:studentId/override',
//   requireRole('PROFESSOR'),
//   auditLog('MANUAL_OVERRIDE'),
//   asyncHandler(SessionController.manualOverride)
// );

// // DELETE /api/sessions/courses/:courseId  — professor soft-deletes their course
// router.delete(
//   '/courses/:courseId',
//   requireRole('PROFESSOR'),
//   auditLog('COURSE_DELETED'),
//   asyncHandler(SessionController.deleteCourse)
// );

// // GET /api/sessions/:sessionId
// router.get('/:sessionId', asyncHandler(SessionController.getSession));

// // GET /api/sessions/:sessionId/dashboard
// router.get(
//   '/:sessionId/dashboard',
//   requireRole('PROFESSOR'),
//   asyncHandler(SessionController.getDashboard)
// );

// export default router;






























// D:\smartattend\services\api\src\routes\session.routes.ts
// FULL REPLACEMENT

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
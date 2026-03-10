import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';
import * as StudentController from '../controllers/student.controller';
import { db } from 'src/config/database';

const router = Router();

// GET  /api/students/me  — get own profile
router.get('/me', asyncHandler(StudentController.getMyProfile));

// POST /api/students/enroll-face  — submit enrollment photos
router.post(
  '/enroll-face',
  requireRole('STUDENT'),
  auditLog('FACE_ENROLLMENT'),
  asyncHandler(StudentController.enrollFace)
);

// GET /api/students/enrollment-status — check face enrollment status
router.get(
  '/enrollment-status',
  requireRole('STUDENT'),
  asyncHandler(StudentController.getEnrollmentStatus)
);

// POST /api/students/device-reset-request — request device binding reset
router.post(
  '/device-reset-request',
  auditLog('DEVICE_RESET_REQUESTED'),
  asyncHandler(StudentController.requestDeviceReset)
);

// ── NEW: POST /api/students/face-reset-request — request face data reset ──
router.post(
  '/face-reset-request',
  requireRole('STUDENT'),
  auditLog('FACE_RESET_REQUESTED'),
  asyncHandler(StudentController.requestFaceReset)
);

// GET /api/students/device-reset-status — check reset request status
router.get(
  '/device-reset-status',
  asyncHandler(StudentController.getDeviceResetStatus)
);

// GET /api/students/courses — enrolled courses
router.get(
  '/courses',
  requireRole('STUDENT'),
  asyncHandler(StudentController.getMyCourses)
);

// POST /api/students/fcm-token
router.post(
  '/fcm-token',
  asyncHandler(async (req: any, res) => {
    const { fcm_token } = req.body;
    if (!fcm_token) {
      res.status(400).json({ success: false, error: 'fcm_token required' });
      return;
    }

    const deviceId = (req.headers['x-device-id'] as string) || 'expo-go';

    await db.query(
      `INSERT INTO device_bindings (user_id, device_id, fcm_token, platform, is_active)
       VALUES ($1, $2, $3, 'android', TRUE)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET fcm_token = $3, last_seen_at = NOW(), is_active = TRUE`,
      [req.user.user_id, deviceId, fcm_token]
    );

    // Cache in Redis for fast lookup during session start
    const { redis, RedisKeys } = await import('../config/redis');
    await redis.setex(RedisKeys.fcmToken(req.user.user_id), 86400, fcm_token);

    res.json({ success: true, message: 'Push token registered' });
  })
);

// Add this route before `export default router;`

// GET /api/students/courses/:courseId/attendance-calendar
router.get(
  '/courses/:courseId/attendance-calendar',
  requireRole('STUDENT'),
  asyncHandler(StudentController.getCourseAttendanceCalendar)
);

// GET /api/students/last-location — fetch the student's last saved DB location
router.get(
  '/last-location',
  requireRole('STUDENT'),
  asyncHandler(StudentController.getLastLocation)
);

export default router;
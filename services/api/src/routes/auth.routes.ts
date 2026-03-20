
import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { auditLog } from '../middleware/audit.middleware';
import * as AuthController from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/register/student  — first-time password creation (admin pre-registered)
router.post(
  '/register/student',
  auditLog('AUTH_REGISTER_STUDENT'),
  asyncHandler(AuthController.registerStudent)
);

// POST /api/auth/register/professor
router.post(
  '/register/professor',
  auditLog('AUTH_REGISTER_PROFESSOR'),
  asyncHandler(AuthController.registerProfessor)
);

// POST /api/auth/login
router.post(
  '/login',
  auditLog('AUTH_LOGIN'),
  asyncHandler(AuthController.login)
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  asyncHandler(AuthController.refreshToken)
);

// POST /api/auth/logout
router.post(
  '/logout',
  asyncHandler(AuthController.logout)
);

// POST /api/auth/forgot-password  — request OTP
// Body: { identifier: "email OR roll_number OR employee_code" }
router.post(
  '/forgot-password',
  asyncHandler(AuthController.forgotPassword)
);

// POST /api/auth/reset-password  — verify OTP + set new password
// Body: { identifier, otp, new_password }
router.post(
  '/reset-password',
  auditLog('AUTH_PASSWORD_RESET'),
  asyncHandler(AuthController.resetPassword)
);

export default router;
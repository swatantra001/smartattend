import { Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { db } from '../config/database';
import { redis, RedisKeys } from '../config/redis';
import { AppError } from './error.middleware';
import { AuthRequest, authenticate } from './auth.middleware';
import { logger } from '../config/logger';

export async function deviceBindingMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // First run JWT auth
  authenticate(req, res, async (authErr) => {
    if (authErr) return next(authErr);

    // Admin role skips device binding check
    // return next()
    if (req.user?.role === 'ADMIN' || req.user?.role === 'PROFESSOR') return next();

    // 👈 NEW: Web Platform strict check
    if (req.headers['x-platform'] === 'web') {
      // Check if user has ANY active mobile binding in the database
      const existingBinding = await db.queryOne(
        `SELECT binding_id FROM device_bindings WHERE user_id = $1 AND is_active = TRUE`,
        [req.user!.user_id]
      );
      
      // If no binding exists, they have never logged into the mobile app
      if (!existingBinding) {
        return next(new AppError(403, 'First login on the mobile app to register your device, then you can login here.', 'MOBILE_LOGIN_REQUIRED'));
      }
      
      // If binding exists, let them into the web portal
      return next(); 
    }

    const rawDeviceId = req.headers['x-device-id'] as string;
    if (!rawDeviceId) {
      return next(new AppError(400, 'Device ID header missing', 'NO_DEVICE_ID'));
    }

    // Hash device ID (client sends raw UUID, we compare against stored SHA256)
    const deviceId = createHash('sha256').update(rawDeviceId).digest('hex');
    const userId = req.user!.user_id;

    try {
      // Check Redis cache first
      const cacheKey = `device:valid:${userId}:${deviceId}`;
      const cached = await redis.get(cacheKey);

      if (cached === 'valid') {
        // Update FCM token if provided
        const fcmToken = req.headers['x-fcm-token'] as string;
        if (fcmToken) {
          await redis.setex(RedisKeys.fcmToken(userId), 86400 * 7, fcmToken);
        }
        return next();
      }

      if (cached === 'invalid') {
        return next(new AppError(403, 'Device not recognized. Contact admin to reset device binding.', 'DEVICE_MISMATCH'));
      }

      // Query DB
      const binding = await db.queryOne(
        `SELECT binding_id, is_active FROM device_bindings
         WHERE user_id = $1 AND device_id = $2`,
        [userId, deviceId]
      );
      if (!binding) {
        // Check if user has ANY active binding — if yes, it's a mismatch
        const existingBinding = await db.queryOne(
          `SELECT binding_id FROM device_bindings
           WHERE user_id = $1 AND is_active = TRUE`,
          [userId]
        );

        if (existingBinding) {
          // Device mismatch — check if reset request pending
          const resetReq = await db.queryOne(
            `SELECT request_id, status FROM device_reset_requests
             WHERE user_id = $1 AND new_device_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [userId, deviceId]
          );

          await redis.setex(cacheKey, 60, 'invalid'); // cache for 1 min

          if (resetReq?.status === 'PENDING') {
            return next(new AppError(403, 'Device reset request is pending admin approval.', 'RESET_PENDING'));
          }

          return next(new AppError(403, 'Device not recognized. Contact admin to reset device binding.', 'DEVICE_MISMATCH'));
        }
        // First time login — create binding
        const fcmToken = req.headers['x-fcm-token'] as string | undefined;
        const deviceModel = req.headers['x-device-model'] as string | undefined;
        const platform = req.headers['x-platform'] as string | undefined;

        await db.query(
          `INSERT INTO device_bindings
             (user_id, device_id, device_model, platform, fcm_token, is_active)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (user_id, device_id) DO UPDATE
             SET is_active = TRUE, last_seen_at = NOW(), fcm_token = COALESCE($5, device_bindings.fcm_token)`,
          [userId, deviceId, deviceModel, platform, fcmToken]
        );

        await redis.setex(cacheKey, 300, 'valid');
        return next();
      }
      logger.info(`Device binding found for user ${userId}. Active: ${binding.is_active}`);
      if (!binding.is_active) {
        return next(new AppError(403, 'Device binding deactivated. Contact admin.', 'DEVICE_DEACTIVATED'));
      }

      // Valid — update last seen and cache
      await db.query(
        `UPDATE device_bindings SET last_seen_at = NOW(),
           fcm_token = COALESCE($3, fcm_token)
         WHERE user_id = $1 AND device_id = $2`,
        [userId, deviceId, req.headers['x-fcm-token']]
      );

      await redis.setex(cacheKey, 300, 'valid'); // cache valid for 5 min
      next();
    } catch (err) {
      next(err);
    }
  });
}
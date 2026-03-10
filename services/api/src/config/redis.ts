import IORedis from 'ioredis';
import { logger } from './logger';

const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      logger.error('Redis retry limit reached');
      return null;
    }
    return Math.min(times * 200, 3000);
  },
  reconnectOnError(err) {
    logger.error('Redis connection error:', err.message);
    return true;
  }
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

// ─── KEY HELPERS ──────────────────────────────────────────────────────────────
export const RedisKeys = {
  // Student last-known location  TTL: 5 min
  studentLocation: (studentId: string) => `loc:${studentId}`,

  // Active attendance session state  TTL: session duration
  sessionState: (sessionId: string) => `session:${sessionId}`,

  // Scene baseline feature vector for a session
  sceneBaseline: (sessionId: string) => `scene:baseline:${sessionId}`,

  // Scene sample count
  sceneSampleCount: (sessionId: string) => `scene:count:${sessionId}`,

  // Per-student verification attempt count  TTL: session duration
  verifyAttempts: (sessionId: string, studentId: string) =>
    `verify:attempts:${sessionId}:${studentId}`,

  // Refresh token  TTL: 7 days
  refreshToken: (userId: string) => `refresh:${userId}`,

  // FCM token for user
  fcmToken: (userId: string) => `fcm:${userId}`,

  // Active session for professor (only 1 at a time)
  professorActiveSession: (professorId: string) => `prof:session:${professorId}`,

  // Rate limit: device reset requests
  deviceResetRate: (userId: string) => `reset:rate:${userId}`,
};

export { redis };
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  AI_ENGINE_URL: z.string().url().default('http://localhost:8000'),
  INTERNAL_SECRET: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  ALLOWED_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.string().default('info'),
  ATTENDANCE_SESSION_DURATION_MINUTES: z.string().default('10'),
  GEOFENCE_RADIUS_METERS: z.string().default('200'),
  MAX_VERIFY_ATTEMPTS: z.string().default('3'),
  FACE_MATCH_THRESHOLD: z.string().default('0.65'),
  SCENE_MATCH_THRESHOLD: z.string().default('0.60'),
  SCENE_MIN_SAMPLES: z.string().default('5'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
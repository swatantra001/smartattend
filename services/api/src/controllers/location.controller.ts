import { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { redis, RedisKeys } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const pingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(5000).optional()
});

// ─── PING LOCATION ────────────────────────────────────────────────────────────
export async function pingLocation(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'STUDENT') {
    throw new AppError(403, 'Only students can ping location', 'FORBIDDEN');
  }

  const { lat, lng, accuracy } = pingSchema.parse(req.body);

  // Get student_id from user_id
  const student = await db.queryOne<{ student_id: string }>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user.user_id]
  );

  if (!student) {
    throw new AppError(404, 'Student profile not found', 'NOT_FOUND');
  }

  // Upsert location using PostGIS geography point
  await db.query(
    `INSERT INTO student_locations (student_id, location, accuracy_meters, updated_at)
     VALUES ($1, ST_MakePoint($3, $2)::geography, $4, NOW())
     ON CONFLICT (student_id)
     DO UPDATE SET
       location = ST_MakePoint($3, $2)::geography,
       accuracy_meters = $4,
       updated_at = NOW()`,
    [student.student_id, lat, lng, accuracy ?? null]
  );

  // Cache in Redis for fast geofence lookups (TTL: 10 minutes)
  await redis.setex(
    RedisKeys.studentLocation(student.student_id),
    600,
    JSON.stringify({ lat, lng, accuracy, updated_at: new Date().toISOString() })
  );

  res.json({ success: true, message: 'Location updated' });
}

// ─── GET MY LOCATION ──────────────────────────────────────────────────────────
export async function getMyLocation(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'STUDENT') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  const student = await db.queryOne<{ student_id: string }>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user.user_id]
  );

  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  // Try Redis first
  const cached = await redis.get(RedisKeys.studentLocation(student.student_id));
  if (cached) {
    res.json({ success: true, data: JSON.parse(cached) });
    return;
  }

  // Fallback to DB
  const location = await db.queryOne(
    `SELECT
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng,
       accuracy_meters,
       updated_at
     FROM student_locations
     WHERE student_id = $1`,
    [student.student_id]
  );

  if (!location) {
    throw new AppError(404, 'No location found. Open app and allow location access.', 'NO_LOCATION');
  }

  res.json({ success: true, data: location });
}
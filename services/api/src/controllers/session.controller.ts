

import { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { redis, RedisKeys } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getStudentsInGeofence, getAllEnrolledStudents } from '../utils/geofence';
import { generateChallenges } from '../utils/challenges';
import { sendMulticastPush } from '../config/firebase';
import { io } from '../index';
import { emitToSession, emitToUser } from '../sockets/socket.handler';

const startSessionSchema = z.object({
  course_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_meters: z.number().min(50).max(500).default(200),
  class_duration_minutes: z.number().int().min(30).max(300).default(60)
});

const overrideSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT']),
  reason: z.string().min(1).max(500)
});

// ─── HELPER: calculate attendance credits ────────────────────────────────────
// 1 credit for a normal lecture (<= 75 min), 2 for longer sessions (> 75 min = 2-hour class)
function calculateAttendanceCredits(durationMinutes: number): number {
  return durationMinutes > 75 ? 2 : 1;
}

// ─── START SESSION ────────────────────────────────────────────────────────────
export async function startSession(req: AuthRequest, res: Response): Promise<void> {
  const body = startSessionSchema.parse(req.body);

  const professor = await db.queryOne<any>(
    'SELECT professor_id, name FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor profile not found', 'NOT_FOUND');

  const existingSession = await redis.get(
    RedisKeys.professorActiveSession(professor.professor_id)
  );
  if (existingSession) {
    throw new AppError(409, 'You already have an active attendance session. End it first.', 'SESSION_ACTIVE');
  }

  const courseEnrollment = await db.queryOne<any>(
    `SELECT ce.course_id, c.name AS course_name, c.code, c.section
     FROM course_enrollments ce
     JOIN courses c ON c.course_id = ce.course_id
     WHERE ce.course_id = $1 AND ce.professor_id = $2 AND c.is_active = TRUE
     LIMIT 1`,
    [body.course_id, professor.professor_id]
  );
  if (!courseEnrollment) {
    throw new AppError(403, 'You are not assigned to this course', 'NOT_AUTHORIZED');
  }

  const sessionDurationMinutes = parseInt(env.ATTENDANCE_SESSION_DURATION_MINUTES) || 10;
  const expiresAt = new Date(Date.now() + sessionDurationMinutes * 60 * 1000);
  const challenges = generateChallenges(2);
  const attendanceCredits = calculateAttendanceCredits(body.class_duration_minutes || 1);

  const session = await db.queryOne<any>(
    `INSERT INTO attendance_sessions
       (professor_id, course_id, professor_location, radius_meters, challenges,
        expires_at, attendance_credits, class_duration_minutes)
     VALUES
       ($1, $2, ST_MakePoint($4, $3)::geography, $5, $6, $7, $8, $9)
     RETURNING session_id, started_at, expires_at, attendance_credits`,
    [
      professor.professor_id,
      body.course_id,
      body.lat,
      body.lng,
      body.radius_meters,
      challenges,
      expiresAt.toISOString(),
      attendanceCredits,
      body.class_duration_minutes
    ]
  );

  logger.info(`Created session in DB: ${JSON.stringify(session)} | Course: ${body.course_id} | Duration: ${sessionDurationMinutes} min | Credits: ${attendanceCredits}`);

  const sessionId = session.session_id;

  await redis.setex(
    RedisKeys.professorActiveSession(professor.professor_id),
    sessionDurationMinutes * 60,
    sessionId
  );

  await redis.setex(
    RedisKeys.sessionState(sessionId),
    sessionDurationMinutes * 60 + 300,
    JSON.stringify({
      session_id: sessionId,
      course_id: body.course_id,
      professor_id: professor.professor_id,
      challenges,
      expires_at: expiresAt.toISOString(),
      radius_meters: body.radius_meters,
      attendance_credits: attendanceCredits
    })
  );

  scheduleSessionExpiry(sessionId, professor.professor_id, sessionDurationMinutes);

  // Start 1-minute periodic re-verification job
  schedulePeriodicRecheck(sessionId, sessionDurationMinutes);

  const studentsInRange = await getStudentsInGeofence(
    body.course_id, body.lat, body.lng, body.radius_meters
  );
  const allEnrolled = await getAllEnrolledStudents(body.course_id);
  // const inRangeIds = new Set(studentsInRange.map((s: any) => s.student_id));
  // const staleStudents = allEnrolled.filter(
  //   (s: any) => s.location_stale && !inRangeIds.has(s.student_id)
  // );
  // const notifyStudents = [
  //   ...studentsInRange,
  //   ...staleStudents.map((s: any) => ({ ...s, distance_meters: -1 }))
  // ];
  // 🟢 STRICT NOTIFICATION: Only students inside the radius with a ping < 5 mins old
  const { rows: notifyStudents } = await db.query(
    `SELECT s.student_id
     FROM course_enrollments ce
     JOIN students s ON s.student_id = ce.student_id
     JOIN student_locations sl ON sl.student_id = s.student_id
     WHERE ce.course_id = $1
       AND sl.updated_at >= NOW() - INTERVAL '5 minutes'
       AND ST_DWithin(
         sl.location,
         ST_MakePoint($3::float, $2::float)::geography,
         $4
       )`,
    [body.course_id, body.lat, body.lng, body.radius_meters]
  );
  //TODO: ADDED
  if (allEnrolled.length > 0) {
    const recordValues = allEnrolled
      .map((s: any) => `('${sessionId}', '${s.student_id}', 'ABSENT', 'PENDING')`)
      .join(', ');

    await db.query(
      `INSERT INTO attendance_records (session_id, student_id, status, verification_status)
       VALUES ${recordValues}
       ON CONFLICT (session_id, student_id) DO NOTHING`
    );
  }

  if (notifyStudents.length > 0) {
    const recordValues = notifyStudents
      .map((s: any) => `('${sessionId}', '${s.student_id}', 'ABSENT', 'PENDING')`)
      .join(', ');

    // await db.query(
    //   `INSERT INTO attendance_records (session_id, student_id, status, verification_status)
    //    VALUES ${recordValues}
    //    ON CONFLICT (session_id, student_id) DO NOTHING`
    // );

    // FIX: Explicitly query FCM tokens for the notified students
    const studentIds = notifyStudents.map((s: any) => s.student_id);
    let fcmTokens: string[] = [];

    if (studentIds.length > 0) {
      const { rows: tokenRows } = await db.query(`
        SELECT db.fcm_token
        FROM students s
        JOIN users u ON u.user_id = s.user_id
        JOIN device_bindings db ON db.user_id = u.user_id
        WHERE s.student_id = ANY($1::uuid[])
          AND db.is_active = TRUE
          AND db.fcm_token IS NOT NULL
      `, [studentIds]);

      // fcmTokens = tokenRows.map(r => r.fcm_token);
      // Enforce unique tokens in JavaScript as a secondary fallback
      fcmTokens = [...new Set(tokenRows.map(r => r.fcm_token))];
    }

    if (fcmTokens.length > 0) {
      await sendMulticastPush(
        fcmTokens,
        '📋 Attendance Started',
        `${courseEnrollment.course_name} — You have ${sessionDurationMinutes} minutes to verify.`,
        {
          type: 'ATTENDANCE_REQUEST',
          session_id: String(sessionId),
          course_id: String(body.course_id),
          course_name: String(courseEnrollment.course_name),
          professor_name: String(professor.name),
          challenges: JSON.stringify(challenges),
          expires_at: String(expiresAt.toISOString()),
          attendance_credits: String(attendanceCredits)
        }
      );
    }

    // EXTRA FEATURE: Schedule a 2-minute warning notification
    scheduleWarningNotification(
      sessionId,
      courseEnrollment.course_name,
      sessionDurationMinutes
    );
  }


  res.status(201).json({
    success: true,
    data: {
      session_id: sessionId,
      course_name: courseEnrollment.course_name,
      course_code: courseEnrollment.code,
      expires_at: session.expire_at,
      started_at: session.started_at,
      duration_minutes: sessionDurationMinutes,
      students_notified: notifyStudents.length,
      students_total: allEnrolled.length,
      students_unnotified: allEnrolled.length - notifyStudents.length,
      attendance_credits: attendanceCredits,
      challenges,
      message: `Session started. Students will earn ${attendanceCredits} attendance credit(s) for this class.`
    }
  });
}

// ─── END SESSION ─────────────────────────────────────────────────────────────
export async function endSession(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const session = await db.queryOne<any>(
    `SELECT session_id, status, professor_id FROM attendance_sessions
     WHERE session_id = $1`,
    [sessionId]
  );
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.professor_id !== professor.professor_id) {
    throw new AppError(403, 'Not your session', 'FORBIDDEN');
  }
  if (session.status !== 'ACTIVE') {
    throw new AppError(409, 'Session already ended', 'SESSION_ENDED');
  }

  await finalizeSession(sessionId, professor.professor_id, 'ENDED');

  res.json({ success: true, message: 'Session ended successfully.' });
}


// ─── MANUAL OVERRIDE ─────────────────────────────────────────────────────────
// Works BOTH during active sessions and after session ends
// PATCH /api/sessions/:sessionId/students/:studentId/override
export async function manualOverride(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId, studentId } = req.params;
  const body = overrideSchema.parse(req.body);

  const professor = await db.queryOne<any>(
    'SELECT professor_id, name FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // Verify session belongs to professor
  const session = await db.queryOne<any>(
    `SELECT session_id, status, course_id FROM attendance_sessions
     WHERE session_id = $1 AND professor_id = $2`,
    [sessionId, professor.professor_id]
  );
  if (!session) {
    throw new AppError(403, 'Session not found or not yours', 'NOT_FOUND');
  }
  // Allow override for both ACTIVE and ENDED sessions
  if (session.status !== 'ACTIVE' && session.status !== 'ENDED') {
    throw new AppError(409, 'Cannot override an expired session', 'SESSION_EXPIRED');
  }

  // Ensure attendance record exists (upsert)
  await db.query(
    `INSERT INTO attendance_records (session_id, student_id, status, verification_status)
     VALUES ($1, $2, $3, 'VERIFIED')
     ON CONFLICT (session_id, student_id) DO UPDATE
     SET status = $3,
         verification_status = 'VERIFIED',
         marked_by = 'PROFESSOR',
         professor_override_by = $4,
         override_reason = $5,
         verification_timestamp = NOW()`,
    [sessionId, studentId, body.status, professor.professor_id, body.reason]
  );

  // Get student info for notification
  const student = await db.queryOne<any>(
    `SELECT s.name, s.roll_number, u.user_id,
            db.fcm_token
     FROM students s
     JOIN users u ON u.user_id = s.user_id
     LEFT JOIN device_bindings db ON db.user_id = u.user_id AND db.is_active = TRUE
     WHERE s.student_id = $1
     ORDER BY db.last_seen_at DESC LIMIT 1`,
    [studentId]
  );

  // Emit socket event to professor dashboard
  emitToSession(io, sessionId, 'STUDENT_MANUAL_OVERRIDE', {
    type: 'STUDENT_MANUAL_OVERRIDE', // added
    session_id: sessionId,
    student_id: studentId,
    data: {
      student_id: studentId,
      name: student?.name,
      roll_number: student?.roll_number,
      status: body.status,
      verification_status: 'VERIFIED',
      marked_by: 'PROFESSOR',
      override_reason: body.reason
    }
  });

  // Notify the student immediately
  if (student?.fcm_token) {
    const isPresent = body.status === 'PRESENT';
    await sendMulticastPush(
      [student.fcm_token],
      isPresent ? '✅ Marked Present' : '❌ Marked Absent',
      isPresent
        ? `Professor ${professor.name} marked you present. Reason: ${body.reason}`
        : `Professor ${professor.name} marked you absent. Reason: ${body.reason}`,
      {
        type: 'ATTENDANCE_OVERRIDE',
        session_id: sessionId,
        new_status: body.status,
        reason: body.reason
      }
    );
  }

  // Look up the student's user_id so we can send to their personal room
  const studentUser = await db.queryOne<{ user_id: string }>(
    'SELECT user_id FROM students WHERE student_id = $1',
    [studentId]
  );

  if (studentUser) {
    emitToUser(io, studentUser.user_id, 'STUDENT_MANUAL_OVERRIDE', {
      type: 'STUDENT_MANUAL_OVERRIDE',
      session_id: sessionId,
      student_id: studentId,
      data: {
        student_id: studentId,
        name: student?.name,
        roll_number: student?.roll_number,
        status: body.status,
        verification_status: 'VERIFIED',
        marked_by: 'PROFESSOR',
        override_reason: body.reason,
      },
    });
  }

  logger.info(`Manual override: ${body.status} for student ${studentId} in session ${sessionId}`);

  res.json({
    success: true,
    message: `Student marked ${body.status} by professor.`
  });
}

// ─── GET ACTIVE SESSION ───────────────────────────────────────────────────────
export async function getActiveSession(req: AuthRequest, res: Response): Promise<void> {
  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const sessionId = await redis.get(
    RedisKeys.professorActiveSession(professor.professor_id)
  );


  if (!sessionId) {
    res.json({ success: true, data: null });
    return;
  }


  const session = await db.queryOne(
    `SELECT
       s.*,
       c.name AS course_name,
       ST_Y(s.professor_location::geometry) AS professor_lat,
       ST_X(s.professor_location::geometry) AS professor_lng
     FROM attendance_sessions s
     JOIN courses c ON c.course_id = s.course_id
     WHERE s.session_id = $1`,
    [sessionId]
  );

  logger.info(`Fetched active session from DB: ${JSON.stringify(session)}`);

  res.json({ success: true, data: session });
}

// ─── GET NEARBY ACTIVE SESSION (student) ──────────────────────────────────────
export async function getNearbyActiveSession(req: AuthRequest, res: Response): Promise<void> {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new AppError(400, 'lat and lng required', 'MISSING_PARAMS');
  }

  const student = await db.queryOne<any>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  const session = await db.queryOne<any>(
    `SELECT
       s.session_id, s.course_id, s.challenges, s.expires_at,
       s.attendance_credits, s.class_duration_minutes, s.radius_meters,
       c.name AS course_name, c.code,
       p.name AS professor_name,
       ST_Distance(s.professor_location, ST_MakePoint($2::float, $1::float)::geography) AS distance_meters
     FROM attendance_sessions s
     JOIN courses c ON c.course_id = s.course_id
     JOIN course_enrollments ce ON ce.course_id = c.course_id
     JOIN professors p ON p.professor_id = s.professor_id
     WHERE s.status = 'ACTIVE'
       AND ce.student_id = $3
       -- 🟢 MODIFIED: Strictly enforce the dynamically stored radius
       AND ST_DWithin(
         s.professor_location,
         ST_MakePoint($2::float, $1::float)::geography,
         s.radius_meters
       )
     ORDER BY distance_meters ASC
     LIMIT 1`,
    [parseFloat(lat as string), parseFloat(lng as string), student.student_id]
  );

  if (!session) {
    res.json({ success: true, data: null, message: 'No active session nearby' });
    return;
  }

  // Check attendance record
  const record = await db.queryOne<any>(
    `SELECT status, verification_status FROM attendance_records
     WHERE session_id = $1 AND student_id = $2`,
    [session.session_id, student.student_id]
  );


  let attemptCount = 0;
  try {
    const redisKey = `verify:attempts:${session.session_id}:${student.student_id}`;
    const raw = await redis.get(redisKey);
    if (raw !== null) {
      attemptCount = parseInt(raw, 10) || 0;
    } else {
      // Fallback: count rows that have a face_score set (each verification attempt writes one)
      // PRESENT rows = successful attempt; rows where verification_status = SUSPICIOUS/FAILED = failed attempts
      // We count ALL attempts (successful + failed) so the student knows their total.
      const attemptRow = await db.queryOne<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt
         FROM attendance_records
         WHERE session_id = $1
           AND student_id = $2
           AND face_score IS NOT NULL`,
        [session.session_id, student.student_id]
      );
      attemptCount = parseInt(attemptRow?.cnt ?? '0', 10);
    }
  } catch {
    // Non-fatal — default to 0
  }

  res.json({
    success: true,
    data: {
      ...session,
      my_status: record?.status ?? null,
      my_verification: record?.verification_status ?? null,
      attempt_count: attemptCount,   // ← NEW field consumed by home.tsx
    }
  });
}

// ─── GET SESSION ──────────────────────────────────────────────────────────────
export async function getSession(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const session = await db.queryOne<any>(
    `SELECT
       s.session_id, s.status, s.started_at, s.expires_at, s.ended_at,
       s.challenges, s.radius_meters, s.attendance_credits, s.class_duration_minutes,
       c.name AS course_name, c.code, c.section,
       p.name AS professor_name
     FROM attendance_sessions s
     JOIN courses c ON c.course_id = s.course_id
     JOIN professors p ON p.professor_id = s.professor_id
     WHERE s.session_id = $1`,
    [sessionId]
  );

  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');

  res.json({ success: true, data: session });
}

// ─── GET DASHBOARD ────────────────────────────────────────────────────────────
export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const session = await db.queryOne<any>(
    `SELECT *
     FROM attendance_sessions
     WHERE session_id = $1 AND professor_id = $2`,
    [sessionId, professor.professor_id]
  );
  if (!session) throw new AppError(403, 'Session not found or not yours', 'NOT_FOUND');


  const { rows } = await db.query(
    `SELECT
       s.student_id,
       s.name,
       s.roll_number,
       s.face_photo_url,
       ar.status,
       ar.verification_status,
       ar.face_score,
       ar.liveness_score,
       ar.scene_score,
       ar.captured_image_b64, -- 👈 NEW
       ar.marked_by,
       ar.override_reason,
       ar.verification_timestamp,
       -- A student is "notified" if their device was within the geofence
       -- We detect this by checking if they have an active device binding
       -- AND their stored location was within radius at session start.
       -- Simplest reliable proxy: student_locations distance check.
       --EXISTS (
       -- SELECT 1
       -- FROM student_locations sl
       -- WHERE sl.student_id = s.student_id
       --  AND ST_DWithin(
       --   sl.location,
       --  sess.professor_location,
       --  sess.radius_meters * 1.5   -- slightly wider to account for GPS drift
       --)
       --) AS notified
       EXISTS (
         SELECT 1
         FROM student_locations sl
         WHERE sl.student_id = s.student_id
           -- 🟢 STRICT TIMING: Their location must have been pinged within 5 mins of the session starting!
           AND sl.updated_at >= sess.started_at - INTERVAL '5 minutes'
           AND ST_DWithin(
             sl.location,
             sess.professor_location,
             sess.radius_meters
           )
       ) AS notified
     FROM attendance_records ar
     JOIN students s ON s.student_id = ar.student_id
     CROSS JOIN (
       SELECT professor_location, radius_meters, started_at
       FROM attendance_sessions WHERE session_id = $1
     ) sess
     WHERE ar.session_id = $1
     ORDER BY s.name ASC`,
    [sessionId]
  );

  const summary = {
    total: rows.length,
    present: rows.filter(r => r.status === 'PRESENT').length,
    absent: rows.filter(r => r.status === 'ABSENT').length,
    suspicious: rows.filter(r => r.verification_status === 'SUSPICIOUS').length,
    pending: rows.filter(r => r.verification_status === 'PENDING').length
  };

  res.json({
    success: true,
    data: {
      session,
      summary,
      students: rows
    }
  });
}

// // ─── PROFESSOR COURSES (with delete option) ───────────────────────────────────
// export async function getProfessorCourses(req: AuthRequest, res: Response): Promise<void> {
//   const professor = await db.queryOne<any>(
//     'SELECT professor_id FROM professors WHERE user_id = $1',
//     [req.user!.user_id]
//   );
//   if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

//   const { rows } = await db.query(
//     `SELECT
//        c.course_id, c.name, c.code, c.section, c.semester, c.is_active,
//        d.name AS dept_name,
//        COUNT(DISTINCT ce.student_id) AS student_count,
//        -- Most recent session info
//        (SELECT asess.started_at FROM attendance_sessions asess
//         WHERE asess.course_id = c.course_id AND asess.professor_id = $1
//         ORDER BY asess.started_at DESC LIMIT 1) AS last_session_at
//      FROM course_enrollments ce
//      JOIN courses c ON c.course_id = ce.course_id
//      JOIN departments d ON d.dept_id = c.dept_id
//      WHERE ce.professor_id = $1 AND c.is_active = TRUE
//      GROUP BY c.course_id, c.name, c.code, c.section, c.semester, c.is_active, d.name
//      ORDER BY c.code ASC`,
//     [professor.professor_id]
//   );

//   res.json({ success: true, data: rows });
// }

// ─── INTERNALS ────────────────────────────────────────────────────────────────
async function finalizeSession(
  sessionId: string,
  professorId: string,
  finalStatus: 'ENDED' | 'EXPIRED'
): Promise<void> {
  await db.query(
    `UPDATE attendance_sessions
     SET status = $2, ended_at = NOW()
     WHERE session_id = $1 AND status = 'ACTIVE'`,
    [sessionId, finalStatus]
  );

  await redis.del(RedisKeys.professorActiveSession(professorId));
  await redis.del(RedisKeys.sessionState(sessionId));

  emitToSession(io, sessionId, 'SESSION_ENDED', {
    session_id: sessionId,
    status: finalStatus
  });

  logger.info(`Session ${finalStatus.toLowerCase()}: ${sessionId}`);
}

function scheduleSessionExpiry(
  sessionId: string,
  professorId: string,
  durationMinutes: number
): void {
  setTimeout(
    async () => {
      try {
        const session = await db.queryOne<any>(
          'SELECT status FROM attendance_sessions WHERE session_id = $1',
          [sessionId]
        );
        if (session?.status === 'ACTIVE') {
          await finalizeSession(sessionId, professorId, 'EXPIRED');
        }
      } catch (err) {
        logger.error(`Session expiry error for ${sessionId}:`, err);
      }
    },
    durationMinutes * 60 * 1000
  );
}

function schedulePeriodicRecheck(sessionId: string, durationMinutes: number): void {
  const intervalMs = 60 * 1000; // every 1 minute
  const totalChecks = durationMinutes;

  let checkCount = 0;

  const interval = setInterval(async () => {
    checkCount++;
    if (checkCount >= totalChecks) {
      clearInterval(interval);
      return;
    }

    try {
      const session = await db.queryOne<any>(
        `SELECT status FROM attendance_sessions WHERE session_id = $1`,
        [sessionId]
      );

      if (!session || session.status !== 'ACTIVE') {
        clearInterval(interval);
        return;
      }

      const aiToken = process.env.INTERNAL_SECRET || process.env.INTERNAL_API_KEY || '';
      const aiUrl = env.AI_ENGINE_URL || 'http://localhost:8000';
      const aiResponse = await fetch(`${aiUrl}/scene/recheck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiToken}`,
          'X-Internal-Token': aiToken,
        },
        body: JSON.stringify({ session_id: sessionId })
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        logger.error(`[SCENE RECHECK FAILED] Python AI Engine returned Status ${aiResponse.status}. Details: ${errText}`);
        return;
      }
      const aiData = await aiResponse.json() as {
        outliers: string[];
        scores: Record<string, number>;
      };

      const outliers: string[] = aiData.outliers || [];

      if (outliers.length === 0) return;
      logger.info(`AI Engine recheck for session ${sessionId}: identified ${outliers.length} outliers: ${outliers.join(', ')}`);

      // 🟢 THE FIX: Group by student and aggregate tokens to prevent duplicates
      const { rows: presentStudents } = await db.query<any>(
        `SELECT 
           ar.student_id, 
           s.name, 
           s.roll_number, 
           u.user_id, 
           COALESCE(array_agg(DISTINCT db.fcm_token) FILTER (WHERE db.fcm_token IS NOT NULL), '{}') as fcm_tokens
         FROM attendance_records ar
         JOIN students s ON s.student_id = ar.student_id
         JOIN users u ON u.user_id = s.user_id
         LEFT JOIN device_bindings db ON db.user_id = u.user_id AND db.is_active = TRUE
         WHERE ar.session_id = $1 
         AND ar.status = 'PRESENT'
         AND ar.student_id = ANY($2::uuid[])
         GROUP BY ar.student_id, s.name, s.roll_number, u.user_id`,
        [sessionId, outliers]
      );

      for (const student of presentStudents) {

        await db.query(
          `UPDATE attendance_records
           SET status = 'ABSENT',
               verification_status = 'SUSPICIOUS',
               marked_by = 'SYSTEM',
               scene_score = $3,
               override_reason = 'Scene Consensus Failed — Background identified as anomaly'
           WHERE session_id = $1 AND student_id = $2`,
          [sessionId, student.student_id, aiData.scores[student.student_id] || 0.0]
        );

        emitToSession(io, sessionId, 'STUDENT_SCENE_FAILED', {
          session_id: sessionId,
          student_id: student.student_id,
          data: {
            student_id: student.student_id,
            name: student.name,
            roll_number: student.roll_number,
            status: 'ABSENT',
            verification_status: 'SUSPICIOUS',
            reason: 'Background anomaly detected against classroom consensus',
            marked_by: 'SYSTEM'
          }
        });

        // 🟢 Properly handle the array of tokens
        const tokens = student.fcm_tokens || [];
        if (tokens.length > 0) {
          await sendMulticastPush(
            tokens,
            '⚠️ Attendance Revoked',
            'Your background does not match the classroom. Attendance revoked.',
            {
              type: 'ATTENDANCE_REVOKED',
              session_id: sessionId,
              reason: 'Scene anomaly detected.'
            }
          );
        }

        io.to(`user:${student.user_id}`).emit('ATTENDANCE_STATUS_CHANGED', {
          session_id: sessionId,
          new_status: 'ABSENT',
          reason: 'Your background does not match the classroom consensus. Revoked.',
          marked_by: 'SYSTEM'
        });

        logger.warn(
          `CROWD CONSENSUS TRIGGERED: Student ${student.roll_number} revoked retroactively ` +
          `in session ${sessionId} (Identified as Outlier).`
        );
      }

    } catch (err) {
      logger.error(`Periodic recheck error for session ${sessionId}:`, err);
    }
  }, intervalMs);
}


export async function getProfessorCourses(req: AuthRequest, res: Response): Promise<void> {
  const professor = await db.queryOne<any>(
    `SELECT p.professor_id, u.college_id
     FROM professors p
     JOIN users u ON u.user_id = p.user_id
     WHERE p.user_id = $1`,
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const { rows } = await db.query(
    `SELECT
       c.course_id,
       c.name,
       c.code,
       c.section,
       c.semester,
       d.name AS dept_name,
       (
         SELECT COUNT(*)::int
         FROM course_enrollments ce
         WHERE ce.course_id = c.course_id
           AND ce.professor_id = $1
       ) AS student_count
     FROM professor_courses pc
     JOIN courses c ON c.course_id = pc.course_id
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE pc.professor_id = $1
       AND (c.is_active = TRUE OR c.is_active IS NULL)
       AND c.deleted_at IS NULL
     ORDER BY c.code ASC, c.section ASC`,
    [professor.professor_id]
  );

  res.json({ success: true, data: rows });
}

// ─── CANCEL SESSION ───────────────────────────────────────────────────────────
// POST /api/sessions/:sessionId/cancel
// Ends session without marking remaining as absent (no-show session)
export async function cancelSession(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const session = await db.queryOne<any>(
    `SELECT session_id, status FROM attendance_sessions
     WHERE session_id = $1 AND professor_id = $2`,
    [sessionId, professor.professor_id]
  );
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.status !== 'ACTIVE') {
    throw new AppError(400, 'Session is not active', 'SESSION_NOT_ACTIVE');
  }

  // Update session status — do NOT mark students absent (cancelled = no records written)
  await db.query(
    `UPDATE attendance_sessions SET status = 'CANCELLED', ended_at = NOW()
     WHERE session_id = $1`,
    [sessionId]
  );

  // Remove PENDING or ABSENT or  records (no mark — session was cancelled before they could verify)
  await db.query(
    `DELETE FROM attendance_records
     WHERE session_id = $1`,
    [sessionId]
  );

  // Clean up Redis
  const { redis, RedisKeys } = await import('../config/redis');
  await redis.del(RedisKeys.professorActiveSession(professor.professor_id));
  await redis.del(RedisKeys.sessionState(sessionId));

  emitToSession(io, sessionId, 'SESSION_CANCELLED', {
    type: 'SESSION_CANCELLED',
    session_id: sessionId,
  });

  logger.info(`Session ${sessionId} cancelled by professor`);
  res.json({ success: true, message: 'Session cancelled. No attendance recorded.' });
}

// ─── DELETE COURSE (soft-delete) ──────────────────────────────────────────────
// DELETE /api/sessions/courses/:courseId
export async function deleteCourse(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // Check no active session
  const active = await db.queryOne<any>(
    `SELECT session_id FROM attendance_sessions
     WHERE course_id = $1 AND professor_id = $2 AND status = 'ACTIVE'`,
    [courseId, professor.professor_id]
  );
  if (active) {
    throw new AppError(400, 'Cannot delete course while a session is active. End the session first.', 'SESSION_ACTIVE');
  }

  // Soft-delete
  await db.query(
    `UPDATE courses
     SET is_active = FALSE, deleted_at = NOW(), deleted_by = $1
     WHERE course_id = $2`,
    [req.user!.user_id, courseId]
  );

  // Also remove professor assignment
  await db.query(
    `DELETE FROM professor_courses WHERE professor_id = $1 AND course_id = $2`,
    [professor.professor_id, courseId]
  );

  res.json({ success: true, message: 'Course removed' });
}


// Add this to the bottom of session.controller.ts
function scheduleWarningNotification(sessionId: string, courseName: string, durationMinutes: number) {
  // If session is 3 mins or less, don't bother with a 2-min warning
  if (durationMinutes <= 3) return;

  const warningTimeMs = (durationMinutes - 2) * 60 * 1000;

  setTimeout(async () => {
    try {
      // 1. Check if session is still ACTIVE
      const session = await db.queryOne<{ status: string }>(
        `SELECT status FROM attendance_sessions WHERE session_id = $1`,
        [sessionId]
      );
      if (session?.status !== 'ACTIVE') return;

      // 2. Find students who are still PENDING
      const { rows: pendingStudents } = await db.query<{ fcm_token: string }>(`
        SELECT db.fcm_token
        FROM attendance_records ar
        JOIN students s ON s.student_id = ar.student_id
        JOIN users u ON u.user_id = s.user_id
        JOIN device_bindings db ON db.user_id = u.user_id
        WHERE ar.session_id = $1 
          AND ar.verification_status = 'PENDING'
          AND db.is_active = TRUE 
          AND db.fcm_token IS NOT NULL
      `, [sessionId]);

      // const fcmTokens = pendingStudents.map(s => s.fcm_token);
      // Enforce unique tokens in JavaScript as a secondary fallback
      const fcmTokens = [...new Set(pendingStudents.map(s => s.fcm_token))];
      // 3. Send the warning
      if (fcmTokens.length > 0) {
        await sendMulticastPush(
          fcmTokens,
          '⏳ 2 Minutes Left!',
          `Attendance for ${courseName} is closing soon. Verify now!`,
          {
            type: 'SESSION_WARNING',
            session_id: sessionId
          }
        );
        logger.info(`Sent 2-min warning to ${fcmTokens.length} students for session ${sessionId}`);
      }
    } catch (err) {
      logger.error(`Warning notification error for session ${sessionId}:`, err);
    }
  }, warningTimeMs);
}


// ADD at bottom of session.controller.ts

// ─── PREVIEW STUDENTS IN RANGE ────────────────────────────────────────────────
// POST /api/sessions/preview-students
// Returns students enrolled in a course who are within radius, with their
// bearing and distance from professor — used by the radar UI

const previewSchema = z.object({
  course_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_meters: z.number().min(50).max(500).default(200),
});

export async function previewStudentsInRange(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const body = previewSchema.parse(req.body);

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // REPLACE the SQL inside previewStudentsInRange:

  // const { rows } = await db.query(
  //   `SELECT
  //      s.student_id,
  //      s.name,
  //      s.roll_number,
  //      s.face_enrolled_at IS NOT NULL AS face_enrolled,
  //      sl.updated_at AS location_updated_at,
  //      -- Raw coordinates for precise client-side positioning
  //      ST_Y(sl.location::geometry) AS student_lat,
  //      ST_X(sl.location::geometry) AS student_lng,
  //      ROUND(ST_Distance(
  //        sl.location,
  //        ST_MakePoint($3::float, $2::float)::geography
  //      ))::int AS distance_meters,
  //      DEGREES(ST_Azimuth(
  //        ST_MakePoint($3::float, $2::float)::geography,
  //        sl.location::geography
  //      )) AS bearing_degrees,
  //      CASE
  //        WHEN sl.location IS NULL THEN 'UNKNOWN'
  //        WHEN ST_DWithin(
  //          sl.location,
  //          ST_MakePoint($3::float, $2::float)::geography,
  //          $4
  //        ) THEN 'IN_RANGE'
  //        WHEN sl.updated_at > NOW() - INTERVAL '10 minutes' THEN 'STALE'
  //        ELSE 'UNKNOWN'
  //      END AS location_status
  //    FROM course_enrollments ce
  //    JOIN students s ON s.student_id = ce.student_id
  //    LEFT JOIN student_locations sl ON sl.student_id = s.student_id
  //    WHERE ce.course_id = $1
  //      AND ce.professor_id = $5
  //    ORDER BY distance_meters ASC NULLS LAST`,
  //   [body.course_id, body.lat, body.lng, body.radius_meters, professor.professor_id]
  // );
  // D:\smartattend\services\api\src\controllers\session.controller.ts

  // Find the previewStudentsInRange function and update the SQL query:
  const { rows } = await db.query(
    `SELECT
       s.student_id,
       s.name,
       s.roll_number,
       s.face_enrolled_at IS NOT NULL AS face_enrolled,
       sl.updated_at AS location_updated_at, -- 🟢 Fetches the exact timestamp
       ST_Y(sl.location::geometry) AS student_lat,
       ST_X(sl.location::geometry) AS student_lng,
       ROUND(ST_Distance(
         sl.location,
         ST_MakePoint($3::float, $2::float)::geography
       ))::int AS distance_meters,
       DEGREES(ST_Azimuth(
         ST_MakePoint($3::float, $2::float)::geography,
         sl.location::geography
       )) AS bearing_degrees,
       CASE
         WHEN sl.location IS NULL THEN 'UNKNOWN'
         -- 🟢 Priority 1: If they are physically OUTSIDE the radius, they are immediately OUT_OF_RANGE (Red)
         WHEN NOT ST_DWithin(sl.location, ST_MakePoint($3::float, $2::float)::geography, $4) THEN 'OUT_OF_RANGE'
         -- 🟢 Priority 2: Now we know they are INSIDE the radius. But is the ping older than 5 minutes? (Orange)
         WHEN sl.updated_at < NOW() - INTERVAL '5 minutes' THEN 'STALE'
         -- 🟢 Priority 3: They are INSIDE the radius AND the ping is FRESH (< 5m) (Green)
         ELSE 'IN_RANGE'
       END AS location_status
     FROM course_enrollments ce
     JOIN students s ON s.student_id = ce.student_id
     LEFT JOIN student_locations sl ON sl.student_id = s.student_id
     WHERE ce.course_id = $1
       AND ce.professor_id = $5
     ORDER BY distance_meters ASC NULLS LAST`,
    [body.course_id, body.lat, body.lng, body.radius_meters, professor.professor_id]
  );

  res.json({
    success: true,
    data: {
      total_enrolled: rows.length,
      in_range: rows.filter(r => r.location_status === 'IN_RANGE').length,
      students: rows,
    }
  });
}

export async function getCourseSessionsList(req: AuthRequest, res: Response) {
  const { courseId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const { rows } = await db.query(`
    SELECT
      s.session_id,
      s.course_id,
      s.status,
      s.started_at,
      s.ended_at,
      s.expires_at,
      s.radius_meters,
      s.attendance_credits,
      s.class_duration_minutes,
      c.name  AS course_name,
      c.code  AS course_code,
      c.section,
      COUNT(ar.record_id) FILTER (WHERE ar.status = 'PRESENT') AS present_count,
      COUNT(ar.record_id) FILTER (WHERE ar.status = 'ABSENT')  AS absent_count,
      COUNT(ar.record_id) AS total_enrolled
    FROM attendance_sessions s
    JOIN courses c ON c.course_id = s.course_id
    LEFT JOIN attendance_records ar ON ar.session_id = s.session_id
    WHERE s.professor_id = $1
      AND s.course_id = $2
    GROUP BY s.session_id, c.name, c.code, c.section
    ORDER BY s.started_at DESC
  `, [professor.professor_id, courseId]);


  res.json({ success: true, data: rows });
}

export async function getSessionRoster(req: AuthRequest, res: Response) {
  const { sessionId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const session = await db.queryOne<any>(
    `SELECT s.*, c.name AS course_name, c.code AS course_code, c.section
     FROM attendance_sessions s
     JOIN courses c ON c.course_id = s.course_id
     WHERE s.session_id = $1 AND s.professor_id = $2`,
    [sessionId, professor.professor_id]
  );
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');

  const { rows } = await db.query(`
    SELECT
      st.student_id,
      st.name,
      st.roll_number,
      st.face_enrolled_at IS NOT NULL AS face_enrolled,
      COALESCE(ar.status, 'ABSENT')              AS status,
      ar.verification_status,
      ar.marked_by,
      ar.override_reason,
      ar.verification_timestamp                  AS marked_at,
      ar.face_score,
      ar.liveness_score,
      ar.scene_score
    FROM course_enrollments ce
    JOIN students st ON st.student_id = ce.student_id
    LEFT JOIN attendance_records ar
      ON ar.student_id = st.student_id
     AND ar.session_id = $1
    WHERE ce.course_id = $2
      AND ce.professor_id = $3
    ORDER BY st.roll_number ASC
  `, [sessionId, session.course_id, professor.professor_id]);

  res.json({
    success: true,
    data: { session, students: rows }
  });
}



// ─── HARD DELETE SESSION ──────────────────────────────────────────────────────
// DELETE /api/sessions/:sessionId
// Permanently deletes a session and ALL its attendance records.
export async function deleteSession(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // Verify the session belongs to this professor
  const session = await db.queryOne<any>(
    `SELECT session_id, status FROM attendance_sessions
     WHERE session_id = $1 AND professor_id = $2`,
    [sessionId, professor.professor_id]
  );
  if (!session) {
    throw new AppError(403, 'Session not found or you are not authorized to delete it.', 'NOT_FOUND');
  }

  // Prevent deleting currently active sessions to avoid weird states
  if (session.status === 'ACTIVE') {
    throw new AppError(400, 'Cannot delete an ACTIVE session. Cancel or end it first.', 'SESSION_ACTIVE');
  }

  // Using a transaction to ensure both records and session are wiped cleanly
  await db.transaction(async (client) => {
    // 1. Delete all attendance records tied to this session
    await client.query(
      `DELETE FROM attendance_records WHERE session_id = $1`,
      [sessionId]
    );

    // 2. Delete the session itself
    await client.query(
      `DELETE FROM attendance_sessions WHERE session_id = $1`,
      [sessionId]
    );
  });

  logger.info(`Session ${sessionId} was HARD DELETED by professor ${professor.professor_id}`);
  res.json({ success: true, message: 'Session permanently deleted.' });
}


// ─── BULK DELETE SESSIONS ─────────────────────────────────────────────────────
// POST /api/sessions/bulk-delete
const bulkDeleteSchema = z.object({
  session_ids: z.array(z.string().uuid()).min(1)
});

export async function bulkDeleteSessions(req: AuthRequest, res: Response): Promise<void> {
  const { session_ids } = bulkDeleteSchema.parse(req.body);

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // Filter out any ACTIVE sessions and ensure the professor owns them
  const { rows: validSessions } = await db.query(
    `SELECT session_id FROM attendance_sessions
     WHERE session_id = ANY($1::uuid[])
       AND professor_id = $2
       AND status != 'ACTIVE'`,
    [session_ids, professor.professor_id]
  );

  const validIds = validSessions.map((r: any) => r.session_id);
  if (validIds.length === 0) {
    throw new AppError(400, 'No valid sessions to delete. (Active sessions cannot be deleted).', 'INVALID_REQUEST');
  }

  await db.transaction(async (client) => {
    await client.query(`DELETE FROM attendance_records WHERE session_id = ANY($1::uuid[])`, [validIds]);
    await client.query(`DELETE FROM attendance_sessions WHERE session_id = ANY($1::uuid[])`, [validIds]);
  });

  // Clean up Redis just in case
  const { redis, RedisKeys } = await import('../config/redis');
  for (const id of validIds) {
    await redis.del(RedisKeys.sessionState(id));
  }

  logger.info(`Bulk deleted ${validIds.length} sessions by professor ${professor.professor_id}`);
  res.json({ success: true, message: `Successfully deleted ${validIds.length} session(s).` });
}
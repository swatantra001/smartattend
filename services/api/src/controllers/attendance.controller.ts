import { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { redis, RedisKeys } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { io } from '../index';
import { emitToSession } from '../sockets/socket.handler';
import axios from 'axios';

const verifySchema = z.object({
  session_id: z.string().uuid(),
  face_frame_base64: z.string().min(100), // base64 encoded JPEG
  liveness_result: z.object({
    challenges_completed: z.array(z.string()),
    scores: z.record(z.number()),
    composite_score: z.number().min(0).max(1)
  })
});

// ─── VERIFY ATTENDANCE ────────────────────────────────────────────────────────
export async function verifyAttendance(req: AuthRequest, res: Response): Promise<void> {
  const body = verifySchema.parse(req.body);

  // Get student profile
  const student = await db.queryOne<any>(
    `SELECT s.student_id, s.name, s.roll_number, s.face_photo_url,
            s.face_embedding, s.face_enrolled_at
     FROM students s
     WHERE s.user_id = $1`,
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  if (!student.face_enrolled_at || !student.face_embedding) {
    throw new AppError(400, 'Face not enrolled. Please complete enrollment first.', 'NOT_ENROLLED');
  }

  // Validate session is active and student has a pending record
  const sessionState = await redis.get(RedisKeys.sessionState(body.session_id));
  if (!sessionState) {
    // Fallback to DB
    const session = await db.queryOne<any>(
      `SELECT session_id, status, challenges, expires_at
       FROM attendance_sessions WHERE session_id = $1`,
      [body.session_id]
    );
    if (!session || session.status !== 'ACTIVE') {
      throw new AppError(400, 'Session is not active or has expired', 'SESSION_INACTIVE');
    }
    if (new Date(session.expires_at) < new Date()) {
      throw new AppError(400, 'Session has expired', 'SESSION_EXPIRED');
    }
  } else {
    const state = JSON.parse(sessionState);
    if (new Date(state.expires_at) < new Date()) {
      throw new AppError(400, 'Session has expired', 'SESSION_EXPIRED');
    }
  }

  // Check existing record
  const existingRecord = await db.queryOne<any>(
    `SELECT record_id, verification_status, status
     FROM attendance_records
     WHERE session_id = $1 AND student_id = $2`,
    [body.session_id, student.student_id]
  );

  if (!existingRecord) {
    throw new AppError(403, 'You were not included in this attendance session. You may be outside the classroom range.', 'NOT_IN_SESSION');
  }

  if (existingRecord.status === 'PRESENT' || existingRecord.verification_status === 'VERIFIED') {
    res.json({ success: true, message: 'Attendance already verified', already_done: true });
    return;
  }

  // Check max retry attempts
  const attemptsKey = RedisKeys.verifyAttempts(body.session_id, student.student_id);
  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) {
    await redis.expire(attemptsKey, 3600); // 1 hour TTL
  }

  const maxAttempts = parseInt(env.MAX_VERIFY_ATTEMPTS);
  if (attempts > maxAttempts) {
    throw new AppError(429, `Maximum verification attempts (${maxAttempts}) reached. Ask professor for manual override.`, 'MAX_ATTEMPTS');
  }

  // ── STEP 1: Validate liveness result ──────────────────────────────────────
  const sessionData = sessionState ? JSON.parse(sessionState) : null;
  const requiredChallenges: string[] = sessionData?.challenges ?? [];

  const livenessScore = body.liveness_result.composite_score;
  const allChallengesCompleted = requiredChallenges.every(
    c => body.liveness_result.challenges_completed.includes(c)
  );

  // In attendance.controller.ts, before the liveness check:
  logger.info('Liveness check', {
    required: requiredChallenges,
    completed: body.liveness_result.challenges_completed,
    score: livenessScore,
  });

  if (!allChallengesCompleted || livenessScore < 0.7) {
    await updateRecord(body.session_id, student.student_id, 'FAILED', {
      liveness_score: livenessScore
    });
    throw new AppError(422, 'Liveness check failed. Please complete all challenges.', 'LIVENESS_FAILED');
  }

  // ── STEP 2: Face recognition via AI engine ────────────────────────────────
  let faceScore = 0;
  let sceneScore = 0;
  let verificationStatus: string = 'FAILED';

  try {
    const aiResponse = await axios.post(
      `${env.AI_ENGINE_URL}/verify`,
      {
        student_id: student.student_id,
        session_id: body.session_id,
        face_frame_base64: body.face_frame_base64,
        stored_embedding: student.face_embedding
      },
      {
        timeout: 15000, headers: {
          'X-Internal-Token': env.INTERNAL_SECRET // Ensure this matches your Python settings
        }
      }
    );

    const aiData = aiResponse.data;
    faceScore = aiData.face_score;
    sceneScore = aiData.scene_score;

    const faceThreshold = parseFloat(env.FACE_MATCH_THRESHOLD);
    const sceneThreshold = parseFloat(env.SCENE_MATCH_THRESHOLD);

    if (faceScore >= faceThreshold && sceneScore >= sceneThreshold) {
      verificationStatus = 'VERIFIED';
    } else if (faceScore >= faceThreshold && sceneScore < sceneThreshold) {
      // Face passed but scene suspicious
      verificationStatus = 'SUSPICIOUS';
    } else {
      verificationStatus = 'FAILED';
    }
  } catch (err: any) {
    logger.error('AI engine error:', err.message);
    throw new AppError(503, 'Verification service temporarily unavailable. Please retry.', 'AI_ENGINE_ERROR');
  }

  // ── STEP 3: Update DB record ──────────────────────────────────────────────
  const isPresent = verificationStatus === 'VERIFIED';
  const isSuspicious = verificationStatus === 'SUSPICIOUS';

  await db.query(
    `UPDATE attendance_records SET
       status = $3,
       verification_status = $4,
       face_score = $5,
       liveness_score = $6,
       scene_score = $7,
       marked_by = 'SYSTEM',
       verification_timestamp = NOW()
     WHERE session_id = $1 AND student_id = $2`,
    [
      body.session_id,
      student.student_id,
      isPresent ? 'PRESENT' : 'ABSENT',
      verificationStatus,
      faceScore,
      livenessScore,
      sceneScore
    ]
  );

  // ── STEP 4: Emit WebSocket event to professor dashboard ───────────────────
  const wsEventType = isPresent
    ? 'STUDENT_VERIFIED'
    : isSuspicious
      ? 'STUDENT_SUSPICIOUS'
      : 'STUDENT_FAILED';

  emitToSession(io, body.session_id, wsEventType, {
    type: wsEventType,
    session_id: body.session_id,
    student_id: student.student_id,
    data: {
      student_id: student.student_id,
      name: student.name,
      roll_number: student.roll_number,
      photo_url: student.face_photo_url,
      status: isPresent ? 'PRESENT' : 'ABSENT',
      verification_status: verificationStatus,
      face_score: faceScore,
      liveness_score: livenessScore,
      scene_score: sceneScore,
      marked_by: 'SYSTEM'
    }
  });

  logger.info(`Verification ${verificationStatus} — Student: ${student.roll_number}, Face: ${faceScore.toFixed(3)}, Scene: ${sceneScore.toFixed(3)}`);

  res.json({
    success: true,
    data: {
      verification_status: verificationStatus,
      is_present: isPresent,
      is_suspicious: isSuspicious,
      face_score: faceScore,
      liveness_score: livenessScore,
      scene_score: sceneScore,
      attempts_remaining: maxAttempts - attempts,
      message: isPresent
        ? '✅ Attendance verified successfully!'
        : isSuspicious
          ? '⚠️ Face matched but location suspicious. Professor will review.'
          : `❌ Verification failed. ${maxAttempts - attempts} attempt(s) remaining.`
    }
  });
}

// ─── GET MY STATUS ────────────────────────────────────────────────────────────
export async function getMyStatus(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const student = await db.queryOne<any>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  const record = await db.queryOne(
    `SELECT status, verification_status, face_score, liveness_score,
            scene_score, marked_by, verification_timestamp
     FROM attendance_records
     WHERE session_id = $1 AND student_id = $2`,
    [sessionId, student.student_id]
  );

  if (!record) {
    throw new AppError(404, 'No attendance record found for this session', 'NOT_FOUND');
  }

  res.json({ success: true, data: record });
}

// ─── GET STUDENT HISTORY ──────────────────────────────────────────────────────
export async function getStudentHistory(req: AuthRequest, res: Response): Promise<void> {
  const student = await db.queryOne<any>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  const { rows } = await db.query(
    `SELECT
       ar.record_id,
       ar.status,
       ar.verification_status,
       ar.face_score,
       ar.liveness_score,
       ar.scene_score,
       ar.marked_by,
       ar.verification_timestamp,
       s.started_at,
       c.name AS course_name,
       c.code AS course_code,
       p.name AS professor_name
     FROM attendance_records ar
     JOIN attendance_sessions s ON s.session_id = ar.session_id
     JOIN courses c ON c.course_id = s.course_id
     JOIN professors p ON p.professor_id = s.professor_id
     WHERE ar.student_id = $1
     ORDER BY s.started_at DESC
     LIMIT 50`,
    [student.student_id]
  );

  res.json({ success: true, data: rows });
}

// ─── GET COURSE REPORT ────────────────────────────────────────────────────────
export async function getCourseReport(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // const { rows } = await db.query(
  //   `SELECT
  //      s.name,
  //      s.roll_number,
  //      COUNT(ar.record_id) AS total_sessions,
  //      COUNT(ar.record_id) FILTER (WHERE ar.status = 'PRESENT') AS present_count,
  //      COUNT(ar.record_id) FILTER (WHERE ar.status = 'ABSENT') AS absent_count,
  //      ROUND(
  //        COUNT(ar.record_id) FILTER (WHERE ar.status = 'PRESENT')::numeric
  //        / NULLIF(COUNT(ar.record_id), 0) * 100, 1
  //      ) AS attendance_percentage
  //    FROM course_enrollments ce
  //    JOIN students s ON s.student_id = ce.student_id
  //    LEFT JOIN attendance_sessions asess ON asess.course_id = ce.course_id
  //    LEFT JOIN attendance_records ar
  //      ON ar.session_id = asess.session_id
  //      AND ar.student_id = s.student_id
  //    WHERE ce.course_id = $1 AND ce.professor_id = $2
  //    GROUP BY s.student_id, s.name, s.roll_number
  //    ORDER BY s.roll_number ASC`,
  //   [courseId, professor.professor_id]
  // );


  // 🟢 MODIFIED: Use SUM(attendance_credits) instead of COUNT(record_id)
  const { rows } = await db.query(
    `SELECT
       s.name, s.roll_number,
       COALESCE(SUM(asess.attendance_credits) FILTER (WHERE asess.status IN ('ACTIVE', 'ENDED', 'EXPIRED')), 0) AS total_sessions,
       COALESCE(SUM(asess.attendance_credits) FILTER (WHERE ar.status = 'PRESENT'), 0) AS present_count,
       COALESCE(SUM(asess.attendance_credits) FILTER (WHERE ar.status = 'ABSENT'), 0) AS absent_count,
       ROUND(
         COALESCE(SUM(asess.attendance_credits) FILTER (WHERE ar.status = 'PRESENT')::numeric, 0)
         / NULLIF(SUM(asess.attendance_credits) FILTER (WHERE asess.status IN ('ACTIVE', 'ENDED', 'EXPIRED')), 0) * 100, 1
       ) AS attendance_percentage
     FROM course_enrollments ce
     JOIN students s ON s.student_id = ce.student_id
     LEFT JOIN attendance_sessions asess ON asess.course_id = ce.course_id
     LEFT JOIN attendance_records ar
       ON ar.session_id = asess.session_id
       AND ar.student_id = s.student_id
     WHERE ce.course_id = $1 AND ce.professor_id = $2
     GROUP BY s.student_id, s.name, s.roll_number
     ORDER BY s.roll_number ASC`,
    [courseId, professor.professor_id]
  );

  res.json({ success: true, data: rows });
}

// ─── HELPER ───────────────────────────────────────────────────────────────────
async function updateRecord(
  sessionId: string,
  studentId: string,
  status: string,
  scores: { face_score?: number; liveness_score?: number; scene_score?: number }
): Promise<void> {
  await db.query(
    `UPDATE attendance_records SET
       status = 'ABSENT',
       verification_status = $3,
       face_score = $4,
       liveness_score = $5,
       scene_score = $6,
       verification_timestamp = NOW()
     WHERE session_id = $1 AND student_id = $2`,
    [
      sessionId,
      studentId,
      status,
      scores.face_score ?? null,
      scores.liveness_score ?? null,
      scores.scene_score ?? null
    ]
  );
}
import { Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { createHash } from 'crypto';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { logger } from '../config/logger';

const enrollFaceSchema = z.object({
  // Array of 5 base64-encoded JPEG photos
  photos: z
    .array(z.string().min(100))
    .min(3)
    .max(7)
});

const deviceResetSchema = z.object({
  reason: z.string().min(10).max(1000),
  new_device_id_raw: z.string().min(10), // raw UUID from new device
  proof_base64: z.string().optional()     // optional proof image
});

const faceResetSchema = z.object({
  reason: z.string().min(10).max(500),
});

// ─── GET MY PROFILE ───────────────────────────────────────────────────────────
export async function getMyProfile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const profile = await db.queryOne(
    `SELECT
       s.student_id,
       s.name,
       s.roll_number,
       s.semester,
       s.face_enrolled_at,
       s.face_photo_url,
       u.email,
       u.is_active,
       d.name AS dept_name,
       d.code AS dept_code,
       c.name AS college_name
     FROM students s
     JOIN users u ON u.user_id = s.user_id
     JOIN departments d ON d.dept_id = s.dept_id
     JOIN colleges c ON c.college_id = u.college_id
     WHERE s.user_id = $1`,
    [req.user!.user_id]
  );

  if (!profile) throw new AppError(404, 'Profile not found', 'NOT_FOUND');

  res.json({ success: true, data: profile });
}

// ─── ENROLL FACE ──────────────────────────────────────────────────────────────
export async function enrollFace(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { photos } = enrollFaceSchema.parse(req.body);

  const student = await db.queryOne<any>(
    'SELECT student_id, name FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  // Call AI engine to extract embeddings from all photos
  let aiResponse: any;
  try {
    aiResponse = await axios.post(
      `${env.AI_ENGINE_URL}/enroll`,
      {
        student_id: student.student_id,
        photos_base64: photos
      },
      {
        timeout: 30000, // enrollment can take longer
        headers: { 'X-Internal-Token': env.INTERNAL_SECRET }
      }
    );
  } catch (err: any) {
    logger.error('AI engine enrollment error:', err.message);
    throw new AppError(
      503,
      'Face enrollment service unavailable. Please try again.',
      'AI_ENGINE_ERROR'
    );
  }

  const { embedding, quality_score, thumbnail_url } = aiResponse.data;

  if (quality_score < 0.70) {
    throw new AppError(
      422,
      'Face enrollment quality too low. Please take photos in good lighting, facing camera directly.',
      'POOR_QUALITY'
    );
  }

  // Store embedding in DB as float array
  await db.query(
    `UPDATE students
     SET face_embedding = $2,
         face_enrolled_at = NOW(),
         face_photo_url = $3
     WHERE student_id = $1`,
    [student.student_id, embedding, thumbnail_url]
  );

  logger.info(`Face enrolled for student: ${student.student_id}`);

  res.json({
    success: true,
    message: 'Face enrolled successfully! You can now mark attendance.',
    data: { quality_score }
  });
}

// ─── GET ENROLLMENT STATUS ────────────────────────────────────────────────────
export async function getEnrollmentStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const student = await db.queryOne<any>(
    `SELECT student_id, face_enrolled_at,
            face_photo_url,
            (face_embedding IS NOT NULL) AS is_enrolled
     FROM students WHERE user_id = $1`,
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  res.json({
    success: true,
    data: {
      is_enrolled: student.is_enrolled,
      enrolled_at: student.face_enrolled_at,
      photo_url: student.face_photo_url
    }
  });
}

// ─── REQUEST DEVICE RESET ─────────────────────────────────────────────────────
export async function requestDeviceReset(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const body = deviceResetSchema.parse(req.body);

  const userId = req.user!.user_id;

  // Rate limit: max 2 reset requests per semester (6 months)
  const rateLimitKey = `reset:rate:${userId}`;
  const recentResets = await db.queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM device_reset_requests
     WHERE user_id = $1
       AND created_at > NOW() - INTERVAL '6 months'`,
    [userId]
  );

  if (parseInt(recentResets?.count ?? '0') >= 5) {
    throw new AppError(
      429,
      'Maximum device reset requests (2 per semester) reached. Contact admin directly.',
      'RATE_LIMITED'
    );
  }

  // Check no pending request already exists
  const pending = await db.queryOne(
    `SELECT request_id FROM device_reset_requests
     WHERE user_id = $1 AND status = 'PENDING'`,
    [userId]
  );
  if (pending) {
    throw new AppError(
      409,
      'You already have a pending device reset request.',
      'ALREADY_PENDING'
    );
  }

  // Hash new device ID
  const newDeviceIdHashed = createHash('sha256')
    .update(body.new_device_id_raw)
    .digest('hex');

  // Get current active device ID
  const currentBinding = await db.queryOne<{ device_id: string }>(
    `SELECT device_id FROM device_bindings
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY last_seen_at DESC LIMIT 1`,
    [userId]
  );

  // Upload proof image to AI engine/S3 if provided (best effort)
  let proofUrl: string | null = null;
  if (body.proof_base64) {
    try {
      const uploadRes = await axios.post(
        `${env.AI_ENGINE_URL}/upload-proof`,
        {
          user_id: userId,
          image_base64: body.proof_base64
        },
        { timeout: 15000 }
      );
      proofUrl = uploadRes.data.url;
    } catch (err) {
      logger.warn('Proof upload failed — continuing without proof');
    }
  }

  // Create reset request
  const request = await db.queryOne(
    `INSERT INTO device_reset_requests
       (user_id, old_device_id, new_device_id, reason, proof_url, status)
     VALUES ($1, $2, $3, $4, $5, 'PENDING')
     RETURNING request_id, created_at`,
    [
      userId,
      currentBinding?.device_id ?? null,
      newDeviceIdHashed,
      body.reason,
      proofUrl
    ]
  );

  logger.info(`Device reset requested by user: ${userId}`);

  res.status(201).json({
    success: true,
    message:
      'Device reset request submitted. Admin will review within 24 hours. You will be notified.',
    data: { request_id: request!.request_id }
  });
}

// ─── GET DEVICE RESET STATUS ──────────────────────────────────────────────────
export async function getDeviceResetStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const request = await db.queryOne(
    `SELECT request_id, status, reason, admin_note, created_at, resolved_at
     FROM device_reset_requests
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user!.user_id]
  );

  res.json({ success: true, data: request ?? null });
}

// ─── REQUEST FACE RESET ───────────────────────────────────────────────────────
export async function requestFaceReset(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const body = faceResetSchema.parse(req.body);

  // 1. Get the student ID
  const student = await db.queryOne<any>(
    'SELECT student_id, face_enrolled_at FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );

  if (!student) throw new AppError(404, 'Student profile not found', 'NOT_FOUND');

  if (!student.face_enrolled_at) {
    throw new AppError(400, 'You have not enrolled your face yet.', 'NOT_ENROLLED');
  }

  // 2. Check if they already have a pending request
  const pending = await db.queryOne(
    `SELECT request_id FROM face_reset_requests WHERE student_id = $1 AND status = 'PENDING'`,
    [student.student_id]
  );

  if (pending) {
    throw new AppError(409, 'You already have a pending face reset request.', 'PENDING_EXISTS');
  }

  // 3. Insert the new request
  await db.query(
    `INSERT INTO face_reset_requests (student_id, reason) VALUES ($1, $2)`,
    [student.student_id, body.reason]
  );

  logger.info(`Face reset requested by user: ${req.user!.user_id}`);

  res.status(201).json({
    success: true,
    message: 'Face reset request submitted.'
  });
}

// ─── GET MY COURSES ───────────────────────────────────────────────────────────
export async function getMyCourses(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const student = await db.queryOne<any>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  // const { rows } = await db.query(
  //   `SELECT
  //      c.course_id,
  //      c.name,
  //      c.code,
  //      c.section,
  //      c.semester,
  //      p.name AS professor_name,
  //      d.name AS dept_name,
  //      -- Attendance summary
  //      COUNT(ar.record_id) AS total_sessions,
  //      COUNT(ar.record_id) FILTER (WHERE ar.status = 'PRESENT') AS attended,
  //      ROUND(
  //        COUNT(ar.record_id) FILTER (WHERE ar.status = 'PRESENT')::numeric
  //        / NULLIF(COUNT(ar.record_id), 0) * 100, 1
  //      ) AS attendance_pct
  //    FROM course_enrollments ce
  //    JOIN courses c ON c.course_id = ce.course_id
  //    JOIN professors p ON p.professor_id = ce.professor_id
  //    JOIN departments d ON d.dept_id = c.dept_id
  //    LEFT JOIN attendance_sessions asess ON asess.course_id = c.course_id
  //    LEFT JOIN attendance_records ar
  //      ON ar.session_id = asess.session_id
  //      AND ar.student_id = ce.student_id
  //    WHERE ce.student_id = $1
  //    GROUP BY c.course_id, c.name, c.code, c.section,
  //             c.semester, p.name, d.name
  //    ORDER BY c.code ASC`,
  //   [student.student_id]
  // );


  // 🟢 MODIFIED: Use COALESCE and SUM(asess.attendance_credits) for weighted calculations
  const { rows } = await db.query(
    `SELECT
       c.course_id, c.name, c.code, c.section, c.semester,
       p.name AS professor_name, d.name AS dept_name,
       -- Total possible credits across all ENDED/EXPIRED sessions
       COALESCE(SUM(asess.attendance_credits) FILTER (WHERE asess.status IN ('ACTIVE', 'ENDED', 'EXPIRED')), 0) AS total_sessions,
       -- Credits actually earned (student was PRESENT)
       COALESCE(SUM(asess.attendance_credits) FILTER (WHERE ar.status = 'PRESENT'), 0) AS attended,
       -- Percentage calculation
       ROUND(
         COALESCE(SUM(asess.attendance_credits) FILTER (WHERE ar.status = 'PRESENT')::numeric, 0)
         / NULLIF(SUM(asess.attendance_credits) FILTER (WHERE asess.status IN ('ACTIVE', 'ENDED', 'EXPIRED')), 0) * 100, 1
       ) AS attendance_pct
     FROM course_enrollments ce
     JOIN courses c ON c.course_id = ce.course_id
     JOIN professors p ON p.professor_id = ce.professor_id
     JOIN departments d ON d.dept_id = c.dept_id
     LEFT JOIN attendance_sessions asess ON asess.course_id = c.course_id
     LEFT JOIN attendance_records ar
       ON ar.session_id = asess.session_id
       AND ar.student_id = ce.student_id
     WHERE ce.student_id = $1
     GROUP BY c.course_id, c.name, c.code, c.section, c.semester, p.name, d.name
     ORDER BY c.code ASC`,
    [student.student_id]
  );

  res.json({ success: true, data: rows });
}






// ─────────────────────────────────────────────────────────────────────────────
// ADD these two functions to the BOTTOM of:
// D:\smartattend\services\api\src\controllers\professor.controller.ts
// (or whichever file handles professor routes)
// ─────────────────────────────────────────────────────────────────────────────

// ─── SEARCH STUDENTS (for professor to find students before enrolling) ─────────
// GET /api/professors/courses/:courseId/search-students?q=roll_or_name
export async function searchStudentsForEnrollment(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { courseId } = req.params;
  const q = (req.query.q as string || '').trim();

  if (!q || q.length < 2) {
    res.json({ success: true, data: [] });
    return;
  }

  const professor = await db.queryOne<any>(
    'SELECT professor_id, college_id FROM professors p JOIN users u ON u.user_id = p.user_id WHERE p.user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // Search students in same college, show if already enrolled or not
  const { rows } = await db.query(
    `SELECT
       s.student_id,
       s.name,
       s.roll_number,
       s.semester,
       d.name AS dept_name,
       s.pending_email,
       u.email,
       s.face_enrolled_at,
       CASE WHEN ce.enrollment_id IS NOT NULL THEN true ELSE false END AS already_enrolled
     FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     LEFT JOIN users u ON u.user_id = s.user_id
     LEFT JOIN course_enrollments ce
       ON ce.student_id = s.student_id AND ce.course_id = $1
     WHERE d.college_id = $2
       AND (
         s.roll_number ILIKE $3
         OR s.name ILIKE $3
         OR u.email ILIKE $3
         OR s.pending_email ILIKE $3
       )
     ORDER BY s.roll_number ASC
     LIMIT 20`,
    [courseId, req.user!.college_id, `%${q}%`]
  );

  res.json({ success: true, data: rows });
}

// ─── ENROLL STUDENTS INTO COURSE (by roll numbers) ────────────────────────────
// POST /api/professors/courses/:courseId/enroll
// Body: { roll_numbers: string[] }
const enrollSchema = z.object({
  roll_numbers: z.array(z.string().min(1).max(50)).min(1).max(200),
});

export async function professorEnrollStudents(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { courseId } = req.params;
  const { roll_numbers } = enrollSchema.parse(req.body);

  // Verify professor owns this course
  const professor = await db.queryOne<any>(
    `SELECT p.professor_id
     FROM professors p
     JOIN course_enrollments ce ON ce.professor_id = p.professor_id
     WHERE p.user_id = $1 AND ce.course_id = $2
     LIMIT 1`,
    [req.user!.user_id, courseId]
  );
  if (!professor) throw new AppError(403, 'You are not assigned to this course', 'FORBIDDEN');

  // Deduplicate
  const uniqueRolls = [...new Set(roll_numbers.map(r => r.trim().toUpperCase()))];

  // Lookup all students in one query
  const { rows: foundStudents } = await db.query(
    `SELECT s.student_id, s.roll_number, s.name
     FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE UPPER(s.roll_number) = ANY($1::text[])
       AND d.college_id = $2`,
    [uniqueRolls, req.user!.college_id]
  );

  const foundRolls = new Set(foundStudents.map((s: any) => s.roll_number.toUpperCase()));

  // Figure out which rolls weren't found
  const notFound = uniqueRolls
    .filter(r => !foundRolls.has(r))
    .map(roll => ({ roll_number: roll, reason: 'Student not found. Ask admin to register them first.' }));

  if (foundStudents.length === 0) {
    res.json({
      success: true,
      data: {
        enrolled: 0,
        already_enrolled: 0,
        not_added: notFound,
      }
    });
    return;
  }

  // Check which are already enrolled
  const { rows: existingEnrollments } = await db.query(
    `SELECT student_id FROM course_enrollments
     WHERE course_id = $1 AND student_id = ANY($2::uuid[])`,
    [courseId, foundStudents.map((s: any) => s.student_id)]
  );
  const alreadyEnrolledIds = new Set(existingEnrollments.map((e: any) => e.student_id));

  const toEnroll = foundStudents.filter((s: any) => !alreadyEnrolledIds.has(s.student_id));
  const alreadyEnrolledList = foundStudents
    .filter((s: any) => alreadyEnrolledIds.has(s.student_id))
    .map((s: any) => ({ roll_number: s.roll_number, reason: 'Already enrolled' }));

  // Bulk insert
  let enrolledCount = 0;
  if (toEnroll.length > 0) {
    const values = toEnroll
      .map((s: any) => `('${courseId}', '${s.student_id}', '${professor.professor_id}')`)
      .join(', ');

    await db.query(
      `INSERT INTO course_enrollments (course_id, student_id, professor_id)
       VALUES ${values}
       ON CONFLICT (course_id, student_id) DO NOTHING`
    );
    enrolledCount = toEnroll.length;
  }

  res.json({
    success: true,
    data: {
      enrolled: enrolledCount,
      already_enrolled: alreadyEnrolledList.length,
      not_added: [...notFound, ...alreadyEnrolledList],
    }
  });
}

// ─── GET ENROLLED STUDENTS IN A COURSE ────────────────────────────────────────
// GET /api/professors/courses/:courseId/students
export async function getCourseStudents(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { courseId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  const { rows } = await db.query(
    `SELECT
       s.student_id,
       s.name,
       s.roll_number,
       s.semester,
       d.name AS dept_name,
       COALESCE(u.email, s.pending_email) AS email,
       s.face_enrolled_at IS NOT NULL AS face_enrolled,
       ce.enrolled_at
     FROM course_enrollments ce
     JOIN students s ON s.student_id = ce.student_id
     JOIN departments d ON d.dept_id = s.dept_id
     LEFT JOIN users u ON u.user_id = s.user_id
     WHERE ce.course_id = $1 AND ce.professor_id = $2
     ORDER BY s.roll_number ASC`,
    [courseId, professor.professor_id]
  );

  res.json({ success: true, data: rows });
}

// ─── REMOVE STUDENT FROM COURSE ───────────────────────────────────────────────
// DELETE /api/professors/courses/:courseId/students/:studentId
export async function professorRemoveStudent(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { courseId, studentId } = req.params;

  const professor = await db.queryOne<any>(
    'SELECT professor_id FROM professors WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // Verify professor owns this course enrollment
  const result = await db.query(
    `DELETE FROM course_enrollments
     WHERE course_id = $1 AND student_id = $2 AND professor_id = $3`,
    [courseId, studentId, professor.professor_id]
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'Enrollment not found or not authorized', 'NOT_FOUND');
  }

  res.json({ success: true, message: 'Student removed from course' });
}


// Add this function at the bottom of student.controller.ts

// ─── GET COURSE ATTENDANCE CALENDAR ──────────────────────────────────────────
export async function getCourseAttendanceCalendar(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { courseId } = req.params;

  const student = await db.queryOne<any>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  // REPLACE the SQL inside getCourseAttendanceCalendar:

  const { rows } = await db.query(
    `SELECT
       TO_CHAR(asess.started_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
       ar.status
     FROM attendance_sessions asess
     JOIN attendance_records ar
       ON ar.session_id = asess.session_id
       AND ar.student_id = $1
     WHERE asess.course_id = $2
       AND asess.status IN ('ENDED', 'EXPIRED')
     ORDER BY asess.started_at ASC`,
    [student.student_id, courseId]
  );

  // Build date → status map. If multiple sessions on same day, PRESENT wins.
  const dateMap: Record<string, string> = {};
  for (const row of rows) {
    if (!dateMap[row.date] || row.status === 'PRESENT') {
      dateMap[row.date] = row.status;
    }
  }
  res.json({ success: true, data: dateMap });
}

// ─── GET LAST SAVED LOCATION ──────────────────────────────────────────────────
export async function getLastLocation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const student = await db.queryOne<any>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [req.user!.user_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  // Extract lat/lng from the PostGIS geography point and get the timestamp
  const loc = await db.queryOne<any>(
    `SELECT 
       ST_Y(location::geometry) AS lat, 
       ST_X(location::geometry) AS lng, 
       updated_at 
     FROM student_locations 
     WHERE student_id = $1`,
    [student.student_id]
  );

  res.json({ success: true, data: loc ?? null });
}
// D:\smartattend\services\api\src\controllers\professor.controller.ts
// NEW FILE — handles all professor-side course & student management

import { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getProfessor(userId: string) {
  const professor = await db.queryOne<any>(
    `SELECT p.professor_id, p.dept_id, u.college_id
     FROM professors p
     JOIN users u ON u.user_id = p.user_id
     WHERE p.user_id = $1`,
    [userId]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');
  return professor;
}

async function verifyProfessorOwnsCourse(courseId: string, professorId: string) {
  // Check there is at least one enrollment row for this professor in this course
  const row = await db.queryOne<any>(
    `SELECT enrollment_id FROM course_enrollments
     WHERE course_id = $1 AND professor_id = $2
     LIMIT 1`,
    [courseId, professorId]
  );
  if (!row) {
    throw new AppError(403, 'You are not assigned to this course', 'FORBIDDEN');
  }
  return row;
}


export async function getAvailableCourses(req: AuthRequest, res: Response): Promise<void> {
  const { professor_id, college_id } = await getProfessor(req.user!.user_id);

  const { rows } = await db.query(
    `SELECT
       c.course_id,
       c.name,
       c.code,
       c.section,
       c.semester,
       d.name        AS dept_name,
       d.dept_id,
       -- is this professor already assigned to this course?
       EXISTS(
         SELECT 1 FROM course_enrollments ce2
         WHERE ce2.course_id = c.course_id
           AND ce2.professor_id = $1
         LIMIT 1
       ) AS is_mine,
       -- how many students enrolled under this professor for this course
       (
         SELECT COUNT(*)::int FROM course_enrollments ce3
         WHERE ce3.course_id = c.course_id
           AND ce3.professor_id = $1
       ) AS my_student_count,
       -- total students enrolled in course (any professor)
       (
         SELECT COUNT(*)::int FROM course_enrollments ce4
         WHERE ce4.course_id = c.course_id
       ) AS total_student_count
     FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE d.college_id = $2
       AND (c.is_active = TRUE OR c.is_active IS NULL)
       AND c.deleted_at IS NULL
     ORDER BY c.code ASC, c.section ASC`,
    [professor_id, college_id]
  );

  res.json({ success: true, data: rows });
}


const assignCourseSchema = z.object({
  course_id: z.string().uuid(),
});

export async function assignCourse(req: AuthRequest, res: Response): Promise<void> {
  const { course_id } = assignCourseSchema.parse(req.body);
  const { professor_id, college_id } = await getProfessor(req.user!.user_id);

  // Verify course belongs to same college
  const course = await db.queryOne<any>(
    `SELECT c.course_id, c.name, c.code, c.section
     FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE c.course_id = $1
       AND d.college_id = $2
       AND (c.is_active = TRUE OR c.is_active IS NULL)
       AND c.deleted_at IS NULL`,
    [course_id, college_id]
  );
  if (!course) throw new AppError(404, 'Course not found or not in your college', 'NOT_FOUND');

  // Check if already assigned
  const existing = await db.queryOne<any>(
    `SELECT assignment_id FROM professor_courses
     WHERE professor_id = $1 AND course_id = $2`,
    [professor_id, course_id]
  );
  if (existing) {
    throw new AppError(409, 'You are already assigned to this course', 'ALREADY_ASSIGNED');
  }

  // Insert into professor_courses (new table — see migration below)
  await db.query(
    `INSERT INTO professor_courses (professor_id, course_id)
     VALUES ($1, $2)`,
    [professor_id, course_id]
  );

  logger.info(`Professor ${professor_id} assigned to course ${course_id}`);

  res.status(201).json({
    success: true,
    message: `You are now assigned to ${course.name}${course.section ? ` (${course.section})` : ''}`,
    data: course,
  });
}


export async function unassignCourse(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;
  const { professor_id } = await getProfessor(req.user!.user_id);

  // Cannot unassign if active session exists
  const activeSession = await db.queryOne<any>(
    `SELECT session_id FROM attendance_sessions
     WHERE course_id = $1 AND professor_id = $2 AND status = 'ACTIVE'`,
    [courseId, professor_id]
  );
  if (activeSession) {
    throw new AppError(400, 'Cannot unassign while an active session is running. End the session first.', 'SESSION_ACTIVE');
  }

  const result = await db.query(
    `DELETE FROM professor_courses
     WHERE professor_id = $1 AND course_id = $2`,
    [professor_id, courseId]
  );

  if ((result as any).rowCount === 0) {
    throw new AppError(404, 'Course assignment not found', 'NOT_FOUND');
  }

  res.json({ success: true, message: 'Course unassigned successfully' });
}

// ─── GET PROFESSOR'S COURSES ──────────────────────────────────────────────────
/**
 * GET /api/professors/courses
 *
 * Returns courses the professor is assigned to (via professor_courses table),
 * with student counts.
 */
export async function getProfessorCourses(req: AuthRequest, res: Response): Promise<void> {
  const { professor_id } = await getProfessor(req.user!.user_id);

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
    [professor_id]
  );

  res.json({ success: true, data: rows });
}

// ─── SEARCH STUDENTS FOR ENROLLMENT ──────────────────────────────────────────
/**
 * GET /api/professors/courses/:courseId/search-students?q=
 */
export async function searchStudentsForEnrollment(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;
  const q = ((req.query.q as string) || '').trim();

  if (!q || q.length < 2) {
    res.json({ success: true, data: [] });
    return;
  }

  const { professor_id, college_id } = await getProfessor(req.user!.user_id);

  // Verify this professor is assigned to the course
  const assigned = await db.queryOne<any>(
    `SELECT assignment_id FROM professor_courses
     WHERE professor_id = $1 AND course_id = $2`,
    [professor_id, courseId]
  );
  if (!assigned) throw new AppError(403, 'You are not assigned to this course', 'FORBIDDEN');

  const { rows } = await db.query(
    `SELECT
       s.student_id,
       s.name,
       s.roll_number,
       s.semester,
       d.name AS dept_name,
       COALESCE(u.email, s.pending_email) AS email,
       s.face_enrolled_at IS NOT NULL AS face_enrolled,
       EXISTS(
         SELECT 1 FROM course_enrollments ce
         WHERE ce.student_id = s.student_id
           AND ce.course_id = $1
           AND ce.professor_id = $2
       ) AS already_enrolled
     FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     LEFT JOIN users u ON u.user_id = s.user_id
     WHERE d.college_id = $3
       AND (
         UPPER(s.roll_number) LIKE UPPER($4)
         OR s.name ILIKE $4
         OR u.email ILIKE $4
         OR s.pending_email ILIKE $4
       )
     ORDER BY s.roll_number ASC
     LIMIT 20`,
    [courseId, professor_id, college_id, `%${q}%`]
  );

  res.json({ success: true, data: rows });
}

// ─── GET ENROLLED STUDENTS ────────────────────────────────────────────────────
/**
 * GET /api/professors/courses/:courseId/students
 */
export async function getCourseStudents(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;
  const { professor_id } = await getProfessor(req.user!.user_id);

  // Verify assignment
  const assigned = await db.queryOne<any>(
    `SELECT assignment_id FROM professor_courses
     WHERE professor_id = $1 AND course_id = $2`,
    [professor_id, courseId]
  );
  if (!assigned) throw new AppError(403, 'You are not assigned to this course', 'FORBIDDEN');

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
     WHERE ce.course_id = $1
       AND ce.professor_id = $2
     ORDER BY s.roll_number ASC`,
    [courseId, professor_id]
  );

  res.json({ success: true, data: rows });
}

// ─── ENROLL STUDENTS BY ROLL NUMBERS ─────────────────────────────────────────
/**
 * POST /api/professors/courses/:courseId/enroll
 * Body: { roll_numbers: string[] }
 */
const enrollSchema = z.object({
  roll_numbers: z.array(z.string().min(1).max(50)).min(1).max(300),
});

export async function enrollStudents(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;
  const { roll_numbers } = enrollSchema.parse(req.body);
  const { professor_id, college_id } = await getProfessor(req.user!.user_id);

  // Verify assignment
  const assigned = await db.queryOne<any>(
    `SELECT assignment_id FROM professor_courses
     WHERE professor_id = $1 AND course_id = $2`,
    [professor_id, courseId]
  );
  if (!assigned) throw new AppError(403, 'You are not assigned to this course', 'FORBIDDEN');

  const uniqueRolls = [...new Set(roll_numbers.map(r => r.trim().toUpperCase()))];

  // Find all students matching those roll numbers in the same college
  const { rows: foundStudents } = await db.query(
    `SELECT s.student_id, s.roll_number, s.name
     FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE UPPER(s.roll_number) = ANY($1::text[])
       AND d.college_id = $2`,
    [uniqueRolls, college_id]
  );

  const foundRolls = new Set(foundStudents.map((s: any) => s.roll_number.toUpperCase()));
  const notFound = uniqueRolls
    .filter(r => !foundRolls.has(r))
    .map(roll => ({ roll_number: roll, reason: 'Student not found. Ask admin to register them first.' }));

  if (foundStudents.length === 0) {
    res.json({ success: true, data: { enrolled: 0, already_enrolled: 0, not_added: notFound } });
    return;
  }

  // Check which are already enrolled under THIS professor for this course
  const { rows: existingEnrollments } = await db.query(
    `SELECT student_id FROM course_enrollments
     WHERE course_id = $1
       AND professor_id = $2
       AND student_id = ANY($3::uuid[])`,
    [courseId, professor_id, foundStudents.map((s: any) => s.student_id)]
  );
  const alreadyEnrolledIds = new Set(existingEnrollments.map((e: any) => e.student_id));

  const toEnroll  = foundStudents.filter((s: any) => !alreadyEnrolledIds.has(s.student_id));
  const alreadyList = foundStudents
    .filter((s: any) => alreadyEnrolledIds.has(s.student_id))
    .map((s: any) => ({ roll_number: s.roll_number, reason: 'Already enrolled in this course' }));

  let enrolledCount = 0;
  if (toEnroll.length > 0) {
    const valuesSql = toEnroll
      .map((s: any, i: number) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(', ');
    const params: string[] = [];
    toEnroll.forEach((s: any) => { params.push(courseId, s.student_id, professor_id); });

    await db.query(
      `INSERT INTO course_enrollments (course_id, student_id, professor_id)
       VALUES ${valuesSql}
       ON CONFLICT (course_id, student_id) DO NOTHING`,
      params
    );
    enrolledCount = toEnroll.length;
  }

  logger.info(`Professor ${professor_id} enrolled ${enrolledCount} students into course ${courseId}`);

  res.json({
    success: true,
    data: {
      enrolled: enrolledCount,
      already_enrolled: alreadyList.length,
      not_added: [...notFound, ...alreadyList],
    },
  });
}

// ─── REMOVE STUDENT FROM COURSE ───────────────────────────────────────────────
/**
 * DELETE /api/professors/courses/:courseId/students/:studentId
 */
export async function removeStudent(req: AuthRequest, res: Response): Promise<void> {
  const { courseId, studentId } = req.params;
  const { professor_id } = await getProfessor(req.user!.user_id);

  // Verify assignment
  const assigned = await db.queryOne<any>(
    `SELECT assignment_id FROM professor_courses
     WHERE professor_id = $1 AND course_id = $2`,
    [professor_id, courseId]
  );
  if (!assigned) throw new AppError(403, 'You are not assigned to this course', 'FORBIDDEN');

  const result = await db.query(
    `DELETE FROM course_enrollments
     WHERE course_id = $1 AND student_id = $2 AND professor_id = $3`,
    [courseId, studentId, professor_id]
  );

  if ((result as any).rowCount === 0) {
    throw new AppError(404, 'Student enrollment not found', 'NOT_FOUND');
  }

  res.json({ success: true, message: 'Student removed from course' });
}
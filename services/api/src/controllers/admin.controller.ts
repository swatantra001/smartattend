
import { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { sendMulticastPush } from 'src/config/firebase';

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────
const preRegisterStudentSchema = z.object({
  email: z.string().email(),
  roll_number: z.string().min(2).max(30),
  name: z.string().min(2).max(100),
  dept_id: z.string().uuid(),
  semester: z.number().int().min(1).max(10)
});

const preRegisterProfessorSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  employee_code: z.string().min(2).max(20),
  dept_id: z.string().uuid()
});

const updateProfessorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  employee_code: z.string().min(2).max(20).optional(),
  dept_id: z.string().uuid().optional(),
  email: z.string().email().optional()
});

const bulkImportStudentsSchema = z.object({
  students: z.array(z.object({
    email: z.string().email(),
    roll_number: z.string().min(2).max(30),
    name: z.string().min(2).max(100),
    dept_id: z.string().uuid(),
    semester: z.number().int().min(1).max(10)
  })).min(1).max(500)
});

const bulkImportProfessorsSchema = z.object({
  professors: z.array(z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    employee_code: z.string().min(2).max(20),
    dept_id: z.string().uuid()
  })).min(1).max(100)
});

const enrollStudentsSchema = z.object({
  professor_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1)
});

const enrollByRollsSchema = z.object({
  professor_id: z.string().uuid(),
  roll_numbers: z.array(z.string()).min(1)
});

const createCourseSchema = z.object({
  dept_id: z.string().uuid(),
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20),
  section: z.string().max(10).optional(),
  semester: z.number().int().min(1).max(10)
});

const createDeptSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20)
});

// ─── PRE-REGISTER STUDENT (single) ────────────────────────────────────────────
export async function preRegisterStudent(req: AuthRequest, res: Response): Promise<void> {
  const body = preRegisterStudentSchema.parse(req.body);

  const dept = await db.queryOne<any>(
    'SELECT dept_id FROM departments WHERE dept_id = $1 AND college_id = $2',
    [body.dept_id, req.user!.college_id]
  );
  if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');

  const rollExists = await db.queryOne(
    'SELECT student_id FROM students WHERE roll_number = $1',
    [body.roll_number]
  );
  if (rollExists) throw new AppError(409, 'Roll number already registered', 'ROLL_EXISTS');

  const emailExists = await db.queryOne(
    'SELECT student_id FROM students WHERE pending_email = LOWER($1)',
    [body.email]
  );
  if (emailExists) throw new AppError(409, 'Email already pre-registered', 'EMAIL_EXISTS');

  const student = await db.queryOne(
    `INSERT INTO students (dept_id, name, roll_number, semester, pending_email)
     VALUES ($1, $2, $3, $4, LOWER($5))
     RETURNING student_id, name, roll_number, semester`,
    [body.dept_id, body.name, body.roll_number, body.semester, body.email]
  );

  res.status(201).json({ success: true, data: student });
}

// ─── BULK IMPORT STUDENTS ────────────────────────────────────────────────────
export async function bulkImportStudents(req: AuthRequest, res: Response): Promise<void> {
  const { students } = bulkImportStudentsSchema.parse(req.body);

  const results = {
    imported: 0,
    skipped: [] as Array<{ row: number; roll_number: string; reason: string }>
  };

  const rollNumbers = students.map(s => s.roll_number);
  const { rows: existingRolls } = await db.query<{ roll_number: string }>(
    `SELECT roll_number FROM students WHERE roll_number = ANY($1)`,
    [rollNumbers]
  );
  const existingRollSet = new Set(existingRolls.map(r => r.roll_number));

  const emails = students.map(s => s.email.toLowerCase());
  const { rows: existingEmails } = await db.query<{ pending_email: string }>(
    `SELECT pending_email FROM students WHERE pending_email = ANY($1)`,
    [emails]
  );
  const existingEmailSet = new Set(existingEmails.map(e => e.pending_email));

  const deptIds = [...new Set(students.map(s => s.dept_id))];
  const { rows: validDepts } = await db.query<{ dept_id: string }>(
    `SELECT dept_id FROM departments WHERE dept_id = ANY($1) AND college_id = $2`,
    [deptIds, req.user!.college_id]
  );
  const validDeptSet = new Set(validDepts.map(d => d.dept_id));

  const toInsert: typeof students = [];

  students.forEach((s, i) => {
    const row = i + 1;
    if (existingRollSet.has(s.roll_number)) {
      results.skipped.push({ row, roll_number: s.roll_number, reason: 'Roll number already exists' });
      return;
    }
    if (existingEmailSet.has(s.email.toLowerCase())) {
      results.skipped.push({ row, roll_number: s.roll_number, reason: 'Email already pre-registered' });
      return;
    }
    if (!validDeptSet.has(s.dept_id)) {
      results.skipped.push({ row, roll_number: s.roll_number, reason: 'Invalid department ID' });
      return;
    }
    toInsert.push(s);
    existingRollSet.add(s.roll_number);
    existingEmailSet.add(s.email.toLowerCase());
  });

  if (toInsert.length > 0) {
    const valuesClauses = toInsert.map(
      (s, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
    ).join(', ');

    const params: any[] = [];
    toInsert.forEach(s => {
      params.push(s.dept_id, s.name, s.roll_number, s.semester, s.email.toLowerCase());
    });

    await db.query(
      `INSERT INTO students (dept_id, name, roll_number, semester, pending_email)
       VALUES ${valuesClauses}`,
      params
    );
    results.imported = toInsert.length;
  }

  res.status(201).json({
    success: true,
    message: `Imported ${results.imported} student(s). ${results.skipped.length} skipped.`,
    data: results
  });
}

// ─── PRE-REGISTER PROFESSOR (single) ──────────────────────────────────────────
export async function preRegisterProfessor(req: AuthRequest, res: Response): Promise<void> {
  const body = preRegisterProfessorSchema.parse(req.body);

  const dept = await db.queryOne<any>(
    'SELECT dept_id FROM departments WHERE dept_id = $1 AND college_id = $2',
    [body.dept_id, req.user!.college_id]
  );
  if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');

  const codeExists = await db.queryOne(
    'SELECT professor_id FROM professors WHERE employee_code = $1',
    [body.employee_code]
  );
  if (codeExists) throw new AppError(409, 'Employee code already registered', 'CODE_EXISTS');

  const emailExists = await db.queryOne(
    'SELECT professor_id FROM professors WHERE pending_email = LOWER($1)',
    [body.email]
  );
  if (emailExists) throw new AppError(409, 'Email already pre-registered', 'EMAIL_EXISTS');

  const professor = await db.queryOne(
    `INSERT INTO professors (dept_id, name, employee_code, pending_email)
     VALUES ($1, $2, $3, LOWER($4))
     RETURNING professor_id, name, employee_code`,
    [body.dept_id, body.name, body.employee_code, body.email]
  );

  res.status(201).json({ success: true, data: professor });
}

// ─── UPDATE PROFESSOR ─────────────────────────────────────────────────────────
// PATCH /api/admin/professors/:professorId
// Allows editing name, employee_code, dept_id, and pending_email
// If the professor has already registered (user_id is set), email cannot be changed here
export async function updateProfessor(req: AuthRequest, res: Response): Promise<void> {
  const { professorId } = req.params;
  const body = updateProfessorSchema.parse(req.body);

  // Verify professor belongs to this college
  const professor = await db.queryOne<any>(
    `SELECT p.professor_id, p.user_id, p.employee_code, p.pending_email
     FROM professors p
     JOIN departments d ON d.dept_id = p.dept_id
     WHERE p.professor_id = $1 AND d.college_id = $2`,
    [professorId, req.user!.college_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  // If updating employee_code, check uniqueness
  if (body.employee_code && body.employee_code !== professor.employee_code) {
    const codeExists = await db.queryOne(
      'SELECT professor_id FROM professors WHERE employee_code = $1 AND professor_id != $2',
      [body.employee_code, professorId]
    );
    if (codeExists) throw new AppError(409, 'Employee code already in use', 'CODE_EXISTS');
  }

  // If updating dept_id, verify it belongs to this college
  if (body.dept_id) {
    const dept = await db.queryOne(
      'SELECT dept_id FROM departments WHERE dept_id = $1 AND college_id = $2',
      [body.dept_id, req.user!.college_id]
    );
    if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');
  }

  // If updating email, only allow on pre-registered (not yet claimed) professors
  if (body.email) {
    if (professor.user_id) {
      throw new AppError(400, 'Cannot change email of a registered professor. Contact the professor directly.', 'ALREADY_REGISTERED');
    }
    const emailExists = await db.queryOne(
      'SELECT professor_id FROM professors WHERE pending_email = LOWER($1) AND professor_id != $2',
      [body.email, professorId]
    );
    if (emailExists) throw new AppError(409, 'Email already in use', 'EMAIL_EXISTS');
  }

  // Build dynamic SET clause
  const setClauses: string[] = [];
  const params: any[] = [];

  if (body.name) { params.push(body.name); setClauses.push(`name = $${params.length}`); }
  if (body.employee_code) { params.push(body.employee_code); setClauses.push(`employee_code = $${params.length}`); }
  if (body.dept_id) { params.push(body.dept_id); setClauses.push(`dept_id = $${params.length}`); }
  if (body.email) { params.push(body.email.toLowerCase()); setClauses.push(`pending_email = $${params.length}`); }

  if (setClauses.length === 0) {
    throw new AppError(400, 'No fields to update', 'NO_CHANGES');
  }

  params.push(professorId);
  const updated = await db.queryOne(
    `UPDATE professors SET ${setClauses.join(', ')} WHERE professor_id = $${params.length}
     RETURNING professor_id, name, employee_code, pending_email`,
    params
  );

  logger.info(`Professor ${professorId} updated by admin ${req.user!.user_id}`);

  res.json({ success: true, data: updated });
}

// ─── DELETE PROFESSOR ─────────────────────────────────────────────────────────
// DELETE /api/admin/professors/:professorId
// Hard-deletes a pre-registered professor who has NOT yet claimed their account.
// If the professor has already registered (user_id is set), we soft-deactivate instead.
export async function deleteProfessor(req: AuthRequest, res: Response): Promise<void> {
  const { professorId } = req.params;

  // Verify professor belongs to this college
  const professor = await db.queryOne<any>(
    `SELECT p.professor_id, p.user_id, p.name
     FROM professors p
     JOIN departments d ON d.dept_id = p.dept_id
     WHERE p.professor_id = $1 AND d.college_id = $2`,
    [professorId, req.user!.college_id]
  );
  if (!professor) throw new AppError(404, 'Professor not found', 'NOT_FOUND');

  if (professor.user_id) {
    // Professor has registered — soft-deactivate their user account instead
    await db.query('UPDATE users SET is_active = FALSE WHERE user_id = $1', [professor.user_id]);
    await invalidateDeviceCache(professor.user_id);

    logger.info(`Professor ${professorId} (registered) deactivated by admin ${req.user!.user_id}`);

    res.json({
      success: true,
      message: `${professor.name} has already registered. Their account has been deactivated instead of deleted.`,
      deactivated: true
    });
    return;
  }

  // Pre-registered only — check for course_enrollments first
  const enrollmentCount = await db.queryOne<{ count: string }>(
    'SELECT COUNT(*) FROM course_enrollments WHERE professor_id = $1',
    [professorId]
  );
  const count = parseInt(enrollmentCount?.count ?? '0');

  if (count > 0) {
    throw new AppError(
      409,
      `Cannot delete: professor is assigned to ${count} course enrollment(s). Remove them from courses first.`,
      'HAS_ENROLLMENTS'
    );
  }

  // Safe to hard delete
  await db.query('DELETE FROM professors WHERE professor_id = $1', [professorId]);

  logger.info(`Professor ${professorId} (pre-registered) deleted by admin ${req.user!.user_id}`);

  res.json({ success: true, message: `${professor.name} has been removed.`, deleted: true });
}

// ─── BULK IMPORT PROFESSORS ───────────────────────────────────────────────────
export async function bulkImportProfessors(req: AuthRequest, res: Response): Promise<void> {
  const { professors } = bulkImportProfessorsSchema.parse(req.body);

  const results = {
    imported: 0,
    skipped: [] as Array<{ row: number; employee_code: string; reason: string }>
  };

  const codes = professors.map(p => p.employee_code);
  const { rows: existingCodes } = await db.query<{ employee_code: string }>(
    'SELECT employee_code FROM professors WHERE employee_code = ANY($1)',
    [codes]
  );
  const existingCodeSet = new Set(existingCodes.map(r => r.employee_code));

  const emails = professors.map(p => p.email.toLowerCase());
  const { rows: existingEmails } = await db.query<{ pending_email: string }>(
    'SELECT pending_email FROM professors WHERE pending_email = ANY($1)',
    [emails]
  );
  const existingEmailSet = new Set(existingEmails.map(e => e.pending_email));

  const deptIds = [...new Set(professors.map(p => p.dept_id))];
  const { rows: validDepts } = await db.query<{ dept_id: string }>(
    'SELECT dept_id FROM departments WHERE dept_id = ANY($1) AND college_id = $2',
    [deptIds, req.user!.college_id]
  );
  const validDeptSet = new Set(validDepts.map(d => d.dept_id));

  const toInsert: typeof professors = [];

  professors.forEach((p, i) => {
    const row = i + 1;
    if (existingCodeSet.has(p.employee_code)) {
      results.skipped.push({ row, employee_code: p.employee_code, reason: 'Employee code already exists' });
      return;
    }
    if (existingEmailSet.has(p.email.toLowerCase())) {
      results.skipped.push({ row, employee_code: p.employee_code, reason: 'Email already pre-registered' });
      return;
    }
    if (!validDeptSet.has(p.dept_id)) {
      results.skipped.push({ row, employee_code: p.employee_code, reason: 'Invalid department ID' });
      return;
    }
    toInsert.push(p);
    existingCodeSet.add(p.employee_code);
    existingEmailSet.add(p.email.toLowerCase());
  });

  if (toInsert.length > 0) {
    const valuesClauses = toInsert.map(
      (_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
    ).join(', ');

    const params: any[] = [];
    toInsert.forEach(p => {
      params.push(p.dept_id, p.name, p.employee_code, p.email.toLowerCase());
    });

    await db.query(
      `INSERT INTO professors (dept_id, name, employee_code, pending_email)
       VALUES ${valuesClauses}`,
      params
    );
    results.imported = toInsert.length;
  }

  res.status(201).json({
    success: true,
    message: `Imported ${results.imported} professor(s). ${results.skipped.length} skipped.`,
    data: results
  });
}

// ─── LIST STUDENTS ────────────────────────────────────────────────────────────
export async function listStudents(req: AuthRequest, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = req.query.search as string;
  const offset = (page - 1) * limit;

  const params: any[] = [req.user!.college_id, limit, offset];
  let whereClause = '';

  if (search) {
    params.push(`%${search}%`);
    whereClause = `AND (s.name ILIKE $${params.length} OR s.roll_number ILIKE $${params.length} OR u.email ILIKE $${params.length} OR s.pending_email ILIKE $${params.length})`;
  }

  const { rows } = await db.query(
    `SELECT
       s.student_id,
       s.name,
       s.roll_number,
       s.semester,
       s.face_enrolled_at,
       s.pending_email,
       u.email,
       u.is_active,
       u.created_at,
       d.name AS dept_name,
       d.code AS dept_code,
       CASE WHEN u.user_id IS NULL THEN TRUE ELSE FALSE END AS awaiting_registration
     FROM students s
     LEFT JOIN users u ON u.user_id = s.user_id
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE d.college_id = $1
     ${whereClause}
     ORDER BY s.roll_number ASC
     LIMIT $2 OFFSET $3`,
    params
  );

  const countResult = await db.queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE d.college_id = $1`,
    [req.user!.college_id]
  );

  res.json({
    success: true,
    data: rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult?.count ?? '0'),
      pages: Math.ceil(parseInt(countResult?.count ?? '0') / limit)
    }
  });
}

// ─── DEACTIVATE STUDENT ───────────────────────────────────────────────────────
export async function deactivateStudent(req: AuthRequest, res: Response): Promise<void> {
  const { studentId } = req.params;

  const student = await db.queryOne<any>(
    'SELECT s.user_id FROM students s WHERE s.student_id = $1',
    [studentId]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');
  if (!student.user_id) throw new AppError(400, 'Student has not registered yet', 'NOT_REGISTERED');

  await db.query('UPDATE users SET is_active = FALSE WHERE user_id = $1', [student.user_id]);
  await invalidateDeviceCache(student.user_id);

  res.json({ success: true, message: 'Student deactivated' });
}

// ─── ACTIVATE STUDENT ─────────────────────────────────────────────────────────
export async function activateStudent(req: AuthRequest, res: Response): Promise<void> {
  const { studentId } = req.params;

  const student = await db.queryOne<any>(
    'SELECT user_id FROM students WHERE student_id = $1',
    [studentId]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  await db.query('UPDATE users SET is_active = TRUE WHERE user_id = $1', [student.user_id]);

  res.json({ success: true, message: 'Student activated' });
}

// ─── RESET FACE ENROLLMENT ────────────────────────────────────────────────────
export async function resetFaceEnrollment(req: AuthRequest, res: Response): Promise<void> {
  const { studentId } = req.params;

  await db.query(
    `UPDATE students
     SET face_embedding = NULL,
         face_enrolled_at = NULL,
         face_photo_url = NULL
     WHERE student_id = $1`,
    [studentId]
  );

  res.json({ success: true, message: 'Face enrollment reset. Student must re-enroll.' });
}

// ─── LIST PROFESSORS ──────────────────────────────────────────────────────────
export async function listProfessors(req: AuthRequest, res: Response): Promise<void> {
  const { rows } = await db.query(
    `SELECT
       p.professor_id,
       p.name,
       p.employee_code,
       p.pending_email,
       u.email,
       u.is_active,
       d.name AS dept_name,
       d.dept_id,
       CASE WHEN u.user_id IS NULL THEN TRUE ELSE FALSE END AS awaiting_registration
     FROM professors p
     LEFT JOIN users u ON u.user_id = p.user_id
     JOIN departments d ON d.dept_id = p.dept_id
     WHERE d.college_id = $1
     ORDER BY p.name ASC`,
    [req.user!.college_id]
  );

  res.json({ success: true, data: rows });
}

// ─── CREATE COURSE ────────────────────────────────────────────────────────────
export async function createCourse(req: AuthRequest, res: Response): Promise<void> {
  const body = createCourseSchema.parse(req.body);

  const dept = await db.queryOne(
    'SELECT dept_id FROM departments WHERE dept_id = $1 AND college_id = $2',
    [body.dept_id, req.user!.college_id]
  );
  if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');

  const course = await db.queryOne(
    `INSERT INTO courses (dept_id, name, code, section, semester)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [body.dept_id, body.name, body.code, body.section ?? null, body.semester]
  );

  res.status(201).json({ success: true, data: course });
}

// ─── ENROLL STUDENTS IN COURSE (by UUIDs) ─────────────────────────────────────
export async function enrollStudents(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;
  const body = enrollStudentsSchema.parse(req.body);

  const course = await db.queryOne<any>(
    `SELECT c.course_id FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE c.course_id = $1 AND d.college_id = $2 AND c.is_active = TRUE`,
    [courseId, req.user!.college_id]
  );
  if (!course) throw new AppError(404, 'Course not found', 'NOT_FOUND');

  const { rows: validStudents } = await db.query<{ student_id: string }>(
    `SELECT s.student_id FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE s.student_id = ANY($1) AND d.college_id = $2`,
    [body.student_ids, req.user!.college_id]
  );
  const validSet = new Set(validStudents.map(s => s.student_id));
  const notFound = body.student_ids.filter(id => !validSet.has(id));
  const toEnroll = body.student_ids.filter(id => validSet.has(id));

  if (toEnroll.length > 0) {
    const values = toEnroll
      .map(sid => `('${courseId}', '${sid}', '${body.professor_id}')`)
      .join(', ');

    await db.query(
      `INSERT INTO course_enrollments (course_id, student_id, professor_id)
       VALUES ${values}
       ON CONFLICT (course_id, student_id) DO NOTHING`
    );
  }

  res.json({
    success: true,
    message: `${toEnroll.length} student(s) enrolled`,
    data: {
      enrolled: toEnroll.length,
      not_found: notFound.map(id => ({ student_id: id, reason: 'Student not found in this college' }))
    }
  });
}

// ─── ENROLL STUDENTS BY ROLL NUMBERS ─────────────────────────────────────────
export async function enrollByRollNumbers(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;
  const body = enrollByRollsSchema.parse(req.body);

  const course = await db.queryOne<any>(
    `SELECT c.course_id FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE c.course_id = $1 AND d.college_id = $2 AND c.is_active = TRUE`,
    [courseId, req.user!.college_id]
  );
  if (!course) throw new AppError(404, 'Course not found', 'NOT_FOUND');

  const { rows: foundStudents } = await db.query<{
    student_id: string; roll_number: string; user_id: string | null;
  }>(
    `SELECT s.student_id, s.roll_number, s.user_id
     FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE s.roll_number = ANY($1) AND d.college_id = $2`,
    [body.roll_numbers, req.user!.college_id]
  );

  const foundRollSet = new Set(foundStudents.map(s => s.roll_number));
  const notFound = body.roll_numbers.filter(r => !foundRollSet.has(r));

  if (foundStudents.length > 0) {
    const values = foundStudents
      .map(s => `('${courseId}', '${s.student_id}', '${body.professor_id}')`)
      .join(', ');

    await db.query(
      `INSERT INTO course_enrollments (course_id, student_id, professor_id)
       VALUES ${values}
       ON CONFLICT (course_id, student_id) DO NOTHING`
    );
  }

  res.json({
    success: true,
    message: `${foundStudents.length} student(s) enrolled`,
    data: {
      enrolled: foundStudents.length,
      not_added: notFound.map(roll => ({
        roll_number: roll,
        reason: 'Student not found. Please add them first via pre-registration.'
      }))
    }
  });
}

// ─── LIST DEPARTMENTS ─────────────────────────────────────────────────────────
export async function listDepartments(req: AuthRequest, res: Response): Promise<void> {
  const { rows } = await db.query(
    `SELECT d.*, COUNT(s.student_id) AS student_count
     FROM departments d
     LEFT JOIN students s ON s.dept_id = d.dept_id
     WHERE d.college_id = $1
     GROUP BY d.dept_id
     ORDER BY d.name ASC`,
    [req.user!.college_id]
  );

  res.json({ success: true, data: rows });
}

// ─── CREATE DEPARTMENT ────────────────────────────────────────────────────────
export async function createDepartment(req: AuthRequest, res: Response): Promise<void> {
  const body = createDeptSchema.parse(req.body);

  const dept = await db.queryOne(
    `INSERT INTO departments (college_id, name, code)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [req.user!.college_id, body.name, body.code]
  );

  res.status(201).json({ success: true, data: dept });
}

// ─── LIST DEVICE RESET REQUESTS ───────────────────────────────────────────────
export async function listDeviceResetRequests(req: AuthRequest, res: Response): Promise<void> {
  const status = req.query.status || 'PENDING';

  const { rows } = await db.query(
    `SELECT
       drr.request_id,
       drr.user_id,
       drr.old_device_id,
       drr.new_device_id,
       drr.reason,
       drr.proof_url,
       drr.status,
       drr.admin_note,
       drr.created_at,
       drr.resolved_at,
       u.email,
       u.role,
       COALESCE(s.name, p.name) AS user_name
     FROM device_reset_requests drr
     JOIN users u ON u.user_id = drr.user_id
     LEFT JOIN students s ON s.user_id = u.user_id
     LEFT JOIN professors p ON p.user_id = u.user_id
     WHERE u.college_id = $1 AND drr.status = $2
     ORDER BY drr.created_at DESC`,
    [req.user!.college_id, status]
  );

  res.json({ success: true, data: rows });
}

// ─── APPROVE DEVICE RESET ─────────────────────────────────────────────────────
export async function approveDeviceReset(req: AuthRequest, res: Response): Promise<void> {
  const { requestId } = req.params;

  const request = await db.queryOne<any>(
    `SELECT drr.*, u.user_id
     FROM device_reset_requests drr
     JOIN users u ON u.user_id = drr.user_id
     WHERE drr.request_id = $1`,
    [requestId]
  );

  if (!request) throw new AppError(404, 'Request not found', 'NOT_FOUND');
  if (request.status !== 'PENDING') {
    throw new AppError(409, 'Request already processed', 'ALREADY_PROCESSED');
  }

  await db.transaction(async (client) => {
    await client.query(
      'DELETE FROM device_bindings WHERE user_id = $1',
      [request.user_id]
    );
    await client.query(
      `UPDATE device_reset_requests
       SET status = 'APPROVED', admin_id = $2, resolved_at = NOW()
       WHERE request_id = $1`,
      [requestId, req.user!.user_id]
    );
  });

  await invalidateDeviceCache(request.user_id);

  const tokenRecord = await db.queryOne<{ fcm_token: string }>(
    `SELECT fcm_token FROM device_bindings
     WHERE user_id = $1 AND is_active = TRUE AND fcm_token IS NOT NULL
     ORDER BY last_seen_at DESC LIMIT 1`,
    [request.user_id]
  );

  if (tokenRecord?.fcm_token) {
    await sendMulticastPush(
      [tokenRecord.fcm_token],
      '📱 Device Reset Approved',
      'Your request was approved! You can now log in using your new device.',
      { type: 'DEVICE_RESET_APPROVED' }
    );
  }

  logger.info(`Device reset approved for user ${request.user_id}`);
  res.json({ success: true, message: 'Device reset approved. User can now bind new device.' });
}

// ─── REJECT DEVICE RESET ──────────────────────────────────────────────────────
export async function rejectDeviceReset(req: AuthRequest, res: Response): Promise<void> {
  const { requestId } = req.params;
  const { admin_note } = req.body;

  const request = await db.queryOne<any>(
    `SELECT drr.*, u.user_id
     FROM device_reset_requests drr
     JOIN users u ON u.user_id = drr.user_id
     WHERE drr.request_id = $1`,
    [requestId]
  );
  if (!request) throw new AppError(404, 'Request not found', 'NOT_FOUND');

  await db.query(
    `UPDATE device_reset_requests
     SET status = 'REJECTED', admin_id = $2, admin_note = $3, resolved_at = NOW()
     WHERE request_id = $1`,
    [requestId, req.user!.user_id, admin_note || null]
  );

  const tokenRecord = await db.queryOne<{ fcm_token: string }>(
    `SELECT fcm_token FROM device_bindings
     WHERE user_id = $1 AND is_active = TRUE AND fcm_token IS NOT NULL
     ORDER BY last_seen_at DESC LIMIT 1`,
    [request.user_id]
  );

  if (tokenRecord?.fcm_token) {
    await sendMulticastPush(
      [tokenRecord.fcm_token],
      '❌ Device Reset Rejected',
      `Your device reset request was rejected. Reason: ${admin_note}`,
      { type: 'DEVICE_RESET_REJECTED' }
    );
  }

  logger.info(`Device reset rejected for user ${request.user_id}: ${admin_note}`);
  res.json({ success: true, message: 'Device reset request rejected.' });
}

// ─── LIST COURSES ─────────────────────────────────────────────────────────────
export async function listCourses(req: AuthRequest, res: Response): Promise<void> {
  const { rows } = await db.query(
    `SELECT
       c.course_id,
       c.name,
       c.code,
       c.section,
       c.semester,
       c.is_active,
       d.name AS dept_name,
       COUNT(DISTINCT ce.student_id) AS student_count,
       COUNT(DISTINCT ce.professor_id) AS professor_count
     FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     LEFT JOIN course_enrollments ce ON ce.course_id = c.course_id
     WHERE d.college_id = $1
     GROUP BY c.course_id, c.name, c.code, c.section, c.semester, c.is_active, d.name
     ORDER BY c.code ASC`,
    [req.user!.college_id]
  );

  res.json({ success: true, data: rows });
}

// ─── GET AUDIT LOGS ───────────────────────────────────────────────────────────
export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100;
  const action = req.query.action as string;
  const offset = (page - 1) * limit;

  const where = action ? 'AND al.action = $4' : '';
  const params: any[] = [req.user!.college_id, limit, offset];
  if (action) params.push(action);

  const { rows } = await db.query(
    `SELECT
       al.log_id, al.action, al.metadata, al.ip_address, al.created_at,
       u.email, u.role
     FROM audit_logs al
     LEFT JOIN users u ON u.user_id = al.user_id
     WHERE u.college_id = $1 ${where}
     ORDER BY al.created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );

  res.json({ success: true, data: rows });
}

// ─── ATTENDANCE REPORT ────────────────────────────────────────────────────────
export async function getAttendanceReport(req: AuthRequest, res: Response): Promise<void> {
  const { course_id, from_date, to_date } = req.query;

  const params: any[] = [req.user!.college_id];
  const conditions: string[] = ['u.college_id = $1'];

  if (course_id) { params.push(course_id); conditions.push(`asess.course_id = $${params.length}`); }
  if (from_date) { params.push(from_date); conditions.push(`asess.started_at >= $${params.length}`); }
  if (to_date) { params.push(to_date); conditions.push(`asess.started_at <= $${params.length}`); }

  const { rows } = await db.query(
    `SELECT
       s.name AS student_name,
       s.roll_number,
       c.name AS course_name,
       c.code AS course_code,
       ar.status,
       ar.verification_status,
       ar.face_score,
       ar.liveness_score,
       ar.scene_score,
       ar.marked_by,
       ar.override_reason,
       ar.verification_timestamp,
       asess.started_at AS session_date,
       asess.attendance_credits,
       p.name AS professor_name
     FROM attendance_records ar
     JOIN attendance_sessions asess ON asess.session_id = ar.session_id
     JOIN students s ON s.student_id = ar.student_id
     JOIN users u ON u.user_id = s.user_id
     JOIN courses c ON c.course_id = asess.course_id
     JOIN professors p ON p.professor_id = asess.professor_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY asess.started_at DESC, s.roll_number ASC`,
    params
  );

  res.json({ success: true, data: rows });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function invalidateDeviceCache(userId: string): Promise<void> {
  const pattern = `device:valid:${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}

// ─── LIST FACE RESETS ──────────────────────────────────────────────────────────
export async function listFaceResets(req: AuthRequest, res: Response): Promise<void> {
  const status = req.query.status || 'PENDING';

  const { rows } = await db.query(
    `SELECT
       fr.request_id, fr.reason, fr.status, fr.created_at, fr.admin_note, fr.resolved_at,
       s.name AS student_name, s.roll_number, u.email
     FROM face_reset_requests fr
     JOIN students s ON s.student_id = fr.student_id
     JOIN users u ON u.user_id = s.user_id
     WHERE fr.status = $1::face_reset_status
     ORDER BY fr.created_at DESC`,
    [status]
  );

  res.json({ success: true, data: rows });
}

// ─── APPROVE FACE RESET ───────────────────────────────────────────────────────
export async function approveFaceReset(req: AuthRequest, res: Response): Promise<void> {
  const { requestId } = req.params;

  const request = await db.queryOne<any>(
    `SELECT fr.student_id, fr.status, s.user_id
     FROM face_reset_requests fr
     JOIN students s ON s.student_id = fr.student_id
     WHERE fr.request_id = $1`,
    [requestId]
  );

  if (!request) throw new AppError(404, 'Request not found', 'NOT_FOUND');
  if (request.status !== 'PENDING') throw new AppError(400, 'Request already processed', 'ALREADY_PROCESSED');

  await db.query(
    `UPDATE students
     SET face_embedding = NULL, face_photo_url = NULL, face_enrolled_at = NULL
     WHERE student_id = $1`,
    [request.student_id]
  );

  await db.query(
    `UPDATE face_reset_requests
     SET status = 'APPROVED', admin_id = $1, resolved_at = NOW()
     WHERE request_id = $2`,
    [req.user!.user_id, requestId]
  );

  const tokenRecord = await db.queryOne<{ fcm_token: string }>(
    `SELECT fcm_token FROM device_bindings
     WHERE user_id = $1 AND is_active = TRUE AND fcm_token IS NOT NULL
     ORDER BY last_seen_at DESC LIMIT 1`,
    [request.user_id]
  );

  if (tokenRecord?.fcm_token) {
    await sendMulticastPush(
      [tokenRecord.fcm_token],
      '📷 Face Reset Approved',
      'Your face data has been wiped. Please open the app to re-enroll your face.',
      { type: 'FACE_RESET_APPROVED' }
    );
  }

  res.json({ success: true, message: 'Face reset approved. Data wiped.' });
}

// ─── REJECT FACE RESET ────────────────────────────────────────────────────────
export async function rejectFaceReset(req: AuthRequest, res: Response): Promise<void> {
  const { requestId } = req.params;
  const { reason } = req.body;

  if (!reason) throw new AppError(400, 'Rejection reason required', 'MISSING_DATA');

  const request = await db.queryOne<any>(
    `SELECT fr.status, s.user_id
     FROM face_reset_requests fr
     JOIN students s ON s.student_id = fr.student_id
     WHERE fr.request_id = $1`,
    [requestId]
  );

  logger.info(`Rejecting face reset request ${requestId} with reason: ${reason}`);

  if (!request) throw new AppError(404, 'Request not found', 'NOT_FOUND');
  if (request.status !== 'PENDING') throw new AppError(400, 'Request already processed', 'ALREADY_PROCESSED');

  await db.query(
    `UPDATE face_reset_requests
     SET status = 'REJECTED', admin_id = $1, admin_note = $2, resolved_at = NOW()
     WHERE request_id = $3`,
    [req.user!.user_id, reason, requestId]
  );

  const tokenRecord = await db.queryOne<{ fcm_token: string }>(
    `SELECT fcm_token FROM device_bindings
     WHERE user_id = $1 AND is_active = TRUE AND fcm_token IS NOT NULL
     ORDER BY last_seen_at DESC LIMIT 1`,
    [request.user_id]
  );

  if (tokenRecord?.fcm_token) {
    await sendMulticastPush(
      [tokenRecord.fcm_token],
      '❌ Face Reset Rejected',
      `Your face reset request was rejected. Reason: ${reason}`,
      { type: 'FACE_RESET_REJECTED' }
    );
  }

  res.json({ success: true, message: 'Face reset rejected.' });
}



// ─────────────────────────────────────────────────────────────────────────────
// APPEND to admin.controller.ts — paste these at the bottom of the file,
// above (or below) the existing HELPERS section.
// These two functions are the only new additions needed for StudentsPage.
// ─────────────────────────────────────────────────────────────────────────────

// ─── UPDATE STUDENT ───────────────────────────────────────────────────────────
// PATCH /api/admin/students/:studentId
// Editable: name, roll_number, dept_id, semester
// Email (pending_email) is only editable if the student has NOT registered yet.
const updateStudentSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  roll_number: z.string().min(2).max(30).optional(),
  dept_id:     z.string().uuid().optional(),
  semester:    z.number().int().min(1).max(10).optional(),
  email:       z.string().email().optional(),
});

export async function updateStudent(req: AuthRequest, res: Response): Promise<void> {
  const { studentId } = req.params;
  const body = updateStudentSchema.parse(req.body);

  // Verify student belongs to this college
  const student = await db.queryOne<any>(
    `SELECT s.student_id, s.user_id, s.roll_number, s.pending_email
     FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE s.student_id = $1 AND d.college_id = $2`,
    [studentId, req.user!.college_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');

  // Roll number uniqueness check
  if (body.roll_number && body.roll_number !== student.roll_number) {
    const rollExists = await db.queryOne(
      'SELECT student_id FROM students WHERE roll_number = $1 AND student_id != $2',
      [body.roll_number, studentId]
    );
    if (rollExists) throw new AppError(409, 'Roll number already in use', 'ROLL_EXISTS');
  }

  // dept_id must belong to this college
  if (body.dept_id) {
    const dept = await db.queryOne(
      'SELECT dept_id FROM departments WHERE dept_id = $1 AND college_id = $2',
      [body.dept_id, req.user!.college_id]
    );
    if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');
  }

  // Email only changeable before the student registers
  if (body.email) {
    if (student.user_id) {
      throw new AppError(
        400,
        'Cannot change email of a registered student. Contact the student directly.',
        'ALREADY_REGISTERED'
      );
    }
    const emailExists = await db.queryOne(
      'SELECT student_id FROM students WHERE pending_email = LOWER($1) AND student_id != $2',
      [body.email, studentId]
    );
    if (emailExists) throw new AppError(409, 'Email already in use', 'EMAIL_EXISTS');
  }

  // Build dynamic SET clause
  const setClauses: string[] = [];
  const params: any[] = [];

  if (body.name)        { params.push(body.name);                   setClauses.push(`name = $${params.length}`); }
  if (body.roll_number) { params.push(body.roll_number);            setClauses.push(`roll_number = $${params.length}`); }
  if (body.dept_id)     { params.push(body.dept_id);                setClauses.push(`dept_id = $${params.length}`); }
  if (body.semester)    { params.push(body.semester);               setClauses.push(`semester = $${params.length}`); }
  if (body.email)       { params.push(body.email.toLowerCase());    setClauses.push(`pending_email = $${params.length}`); }

  if (setClauses.length === 0) throw new AppError(400, 'No fields to update', 'NO_CHANGES');

  params.push(studentId);
  const updated = await db.queryOne(
    `UPDATE students SET ${setClauses.join(', ')} WHERE student_id = $${params.length}
     RETURNING student_id, name, roll_number, semester, pending_email`,
    params
  );

  logger.info(`Student ${studentId} updated by admin ${req.user!.user_id}`);
  res.json({ success: true, data: updated });
}

// ─── ADMIN CLEAR STUDENT DEVICE BINDING ──────────────────────────────────────
// DELETE /api/admin/students/:studentId/device-binding
// Immediately wipes all device bindings for the student (admin bypass — no approval request needed).
// Use this for: admin support tickets, lost phone, lab/testing scenarios.
export async function adminClearStudentDevice(req: AuthRequest, res: Response): Promise<void> {
  const { studentId } = req.params;

  // Verify student belongs to this college and has a user account
  const student = await db.queryOne<any>(
    `SELECT s.student_id, s.user_id, s.name
     FROM students s
     JOIN departments d ON d.dept_id = s.dept_id
     WHERE s.student_id = $1 AND d.college_id = $2`,
    [studentId, req.user!.college_id]
  );
  if (!student) throw new AppError(404, 'Student not found', 'NOT_FOUND');
  if (!student.user_id) throw new AppError(400, 'Student has not registered yet', 'NOT_REGISTERED');

  // Hard-delete all device bindings (cleaner than marking inactive — forces fresh bind on next login)
  const result = await db.query(
    'DELETE FROM device_bindings WHERE user_id = $1 RETURNING device_id',
    [student.user_id]
  );
  const cleared = result.rows.length;

  // Invalidate Redis device-validation cache
  await invalidateDeviceCache(student.user_id);

  logger.info(`Device bindings cleared for student ${studentId} (${cleared} device(s)) by admin ${req.user!.user_id}`);

  res.json({
    success: true,
    message: `${student.name}'s device binding cleared (${cleared} device(s) removed). They can re-bind on next login.`,
    cleared,
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// APPEND to admin.controller.ts
// Paste these four functions at the bottom of the file.
// All helpers (db, AppError, z, logger, etc.) are already imported there.
// ─────────────────────────────────────────────────────────────────────────────


// ─── GET COURSE DETAIL ────────────────────────────────────────────────────────
// GET /api/admin/courses/:courseId/detail
// Returns the list of enrolled students AND assigned professors for one course.
export async function getCourseDetail(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;

  // Verify course belongs to this college
  const course = await db.queryOne<any>(
    `SELECT c.course_id FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE c.course_id = $1 AND d.college_id = $2`,
    [courseId, req.user!.college_id]
  );
  if (!course) throw new AppError(404, 'Course not found', 'NOT_FOUND');

  // Enrolled students
  const students = await db.query(
    `SELECT
       s.student_id, s.name, s.roll_number, s.semester,
       u.email,
       s.face_enrolled_at
     FROM course_enrollments ce
     JOIN students s  ON s.student_id  = ce.student_id
     LEFT JOIN users u ON u.user_id    = s.user_id
     WHERE ce.course_id = $1
     ORDER BY s.name`,
    [courseId]
  );

  // Assigned professors (via course_assignments or similar join table — adjust table name to match your schema)
  const professors = await db.query(
    `SELECT
       p.professor_id, p.name, p.employee_code,
       u.email
     FROM professor_courses ca           -- or course_professors / professor_courses
     JOIN professors p ON p.professor_id = ca.professor_id
     LEFT JOIN users u ON u.user_id      = p.user_id
     WHERE ca.course_id = $1
     ORDER BY p.name`,
    [courseId]
  );

  res.json({
    success: true,
    data: {
      students:   students.rows,
      professors: professors.rows,
    },
  });
}


// ─── UPDATE COURSE ────────────────────────────────────────────────────────────
// PATCH /api/admin/courses/:courseId
// Editable fields: name, code, section, dept_id, semester
const updateCourseSchema = z.object({
  name:     z.string().min(2).max(150).optional(),
  code:     z.string().min(1).max(30).optional(),
  section:  z.string().max(20).optional().nullable(),
  dept_id:  z.string().uuid().optional(),
  semester: z.number().int().min(1).max(10).optional(),
});

export async function updateCourse(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;
  const body = updateCourseSchema.parse(req.body);

  // Verify course belongs to this college
  const course = await db.queryOne<any>(
    `SELECT c.course_id, c.code
     FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE c.course_id = $1 AND d.college_id = $2`,
    [courseId, req.user!.college_id]
  );
  if (!course) throw new AppError(404, 'Course not found', 'NOT_FOUND');

  // Unique code check (excluding self)
  if (body.code && body.code !== course.code) {
    const exists = await db.queryOne(
      `SELECT course_id FROM courses WHERE code = $1 AND course_id != $2`,
      [body.code, courseId]
    );
    if (exists) throw new AppError(409, 'Course code already in use', 'CODE_EXISTS');
  }

  // dept_id must belong to this college
  if (body.dept_id) {
    const dept = await db.queryOne(
      'SELECT dept_id FROM departments WHERE dept_id = $1 AND college_id = $2',
      [body.dept_id, req.user!.college_id]
    );
    if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');
  }

  // Dynamic SET clause
  const sets: string[] = [];
  const params: any[] = [];

  if (body.name     !== undefined) { params.push(body.name);     sets.push(`name     = $${params.length}`); }
  if (body.code     !== undefined) { params.push(body.code);     sets.push(`code     = $${params.length}`); }
  if (body.section  !== undefined) { params.push(body.section);  sets.push(`section  = $${params.length}`); }
  if (body.dept_id  !== undefined) { params.push(body.dept_id);  sets.push(`dept_id  = $${params.length}`); }
  if (body.semester !== undefined) { params.push(body.semester); sets.push(`semester = $${params.length}`); }

  if (sets.length === 0) throw new AppError(400, 'No fields to update', 'NO_CHANGES');

  params.push(courseId);
  const updated = await db.queryOne(
    `UPDATE courses SET ${sets.join(', ')} WHERE course_id = $${params.length}
     RETURNING course_id, name, code, section, semester`,
    params
  );

  logger.info(`Course ${courseId} updated by admin ${req.user!.user_id}`);
  res.json({ success: true, data: updated });
}


// ─── DELETE (SOFT) COURSE ─────────────────────────────────────────────────────
// DELETE /api/admin/courses/:courseId
// Soft-deletes: sets is_active = false. All attendance records are preserved.
// Professors will no longer be able to start sessions for this course.
export async function deleteCourse(req: AuthRequest, res: Response): Promise<void> {
  const { courseId } = req.params;

  const course = await db.queryOne<any>(
    `SELECT c.course_id, c.is_active
     FROM courses c
     JOIN departments d ON d.dept_id = c.dept_id
     WHERE c.course_id = $1 AND d.college_id = $2`,
    [courseId, req.user!.college_id]
  );
  if (!course) throw new AppError(404, 'Course not found', 'NOT_FOUND');
  if (!course.is_active) throw new AppError(400, 'Course is already inactive', 'ALREADY_INACTIVE');

  await db.query(
    'UPDATE courses SET is_active = false WHERE course_id = $1',
    [courseId]
  );

  logger.info(`Course ${courseId} deactivated by admin ${req.user!.user_id}`);
  res.json({ success: true, message: 'Course deactivated successfully.' });
}


// ─── BULK IMPORT COURSES ──────────────────────────────────────────────────────
// POST /api/admin/courses/bulk-import
// Body: array of { name, code, dept_id, semester, section? }
// Max 200 rows per request.
const bulkCourseRowSchema = z.object({
  name:     z.string().min(2).max(150),
  code:     z.string().min(1).max(30),
  dept_id:  z.string().uuid(),
  semester: z.number().int().min(1).max(10),
  section:  z.string().max(20).optional().nullable(),
});

export async function bulkImportCourses(req: AuthRequest, res: Response): Promise<void> {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    throw new AppError(400, 'Provide a non-empty array of courses', 'INVALID_PAYLOAD');
  if (rows.length > 200)
    throw new AppError(400, 'Maximum 200 courses per import', 'TOO_MANY_ROWS');

  // Validate all dept_ids belong to this college
  const validDepts = await db.query(
    'SELECT dept_id FROM departments WHERE college_id = $1',
    [req.user!.college_id]
  );
  const validDeptSet = new Set(validDepts.rows.map((d: any) => d.dept_id));

  let imported = 0;
  const skipped: Array<{ code: string; reason: string }> = [];

  for (const row of rows) {
    try {
      const parsed = bulkCourseRowSchema.parse(row);
      if (!validDeptSet.has(parsed.dept_id)) {
        skipped.push({ code: parsed.code, reason: 'Department not found in this college' });
        continue;
      }
      // Upsert: skip if code already exists for this college (via dept join)
      const exists = await db.queryOne(
        `SELECT c.course_id FROM courses c
         JOIN departments d ON d.dept_id = c.dept_id
         WHERE c.code = $1 AND d.college_id = $2`,
        [parsed.code, req.user!.college_id]
      );
      if (exists) {
        skipped.push({ code: parsed.code, reason: 'Course code already exists' });
        continue;
      }
      await db.query(
        `INSERT INTO courses (name, code, section, dept_id, semester, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [parsed.name, parsed.code, parsed.section ?? null, parsed.dept_id, parsed.semester]
      );
      imported++;
    } catch (err: any) {
      skipped.push({ code: row?.code ?? '(unknown)', reason: err.message ?? 'Validation error' });
    }
  }

  logger.info(`Bulk import: ${imported} courses created by admin ${req.user!.user_id}`);
  res.json({ success: true, data: { imported, skipped } });
}


// ═══════════════════════════════════════════════════════════════════════════════
// FILE 2 — APPEND to admin.controller.ts
// Paste these four functions at the bottom.
// All helpers (db, z, AppError, logger) are already imported.
// ═══════════════════════════════════════════════════════════════════════════════


// ─── GET DEPARTMENT DETAIL ────────────────────────────────────────────────────
// GET /api/admin/departments/:deptId/detail
// Returns courses, professors and a sample of students for the detail modal.
export async function getDepartmentDetail(req: AuthRequest, res: Response): Promise<void> {
  const { deptId } = req.params;

  // Verify dept belongs to this college
  const dept = await db.queryOne(
    'SELECT dept_id FROM departments WHERE dept_id = $1 AND college_id = $2',
    [deptId, req.user!.college_id]
  );
  if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');

  // Courses in this dept
  const courses = await db.query(
    `SELECT
       c.course_id, c.name, c.code, c.section, c.semester, c.is_active,
       COUNT(DISTINCT ce.student_id)::int AS student_count
     FROM courses c
     LEFT JOIN course_enrollments ce ON ce.course_id = c.course_id
     WHERE c.dept_id = $1
     GROUP BY c.course_id
     ORDER BY c.is_active DESC, c.name`,
    [deptId]
  );

  // Professors in this dept
  const professors = await db.query(
    `SELECT
       p.professor_id, p.name, p.employee_code,
       COALESCE(u.email, p.pending_email) AS email,
       p.user_id IS NULL AS awaiting_registration
     FROM professors p
     LEFT JOIN users u ON u.user_id = p.user_id
     WHERE p.dept_id = $1
     ORDER BY p.name`,
    [deptId]
  );

  // Total student count
  const countRow = await db.queryOne<{total: string}>(
    'SELECT COUNT(*)::int AS total FROM students WHERE dept_id = $1',
    [deptId]
  );
  const total_students = parseInt(countRow?.total ?? '0');

  // First 20 students as a sample for the modal (full list via Students page)
  const students_sample = await db.query(
    `SELECT student_id, name, roll_number, semester
     FROM students
     WHERE dept_id = $1
     ORDER BY name
     LIMIT 20`,
    [deptId]
  );

  res.json({
    success: true,
    data: {
      courses:         courses.rows,
      professors:      professors.rows,
      students_sample: students_sample.rows,
      total_students,
    },
  });
}


// ─── UPDATE DEPARTMENT ────────────────────────────────────────────────────────
// PATCH /api/admin/departments/:deptId
const updateDeptSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(1).max(20).optional(),
});

export async function updateDepartment(req: AuthRequest, res: Response): Promise<void> {
  const { deptId } = req.params;
  const body = updateDeptSchema.parse(req.body);

  const dept = await db.queryOne<any>(
    'SELECT dept_id, code FROM departments WHERE dept_id = $1 AND college_id = $2',
    [deptId, req.user!.college_id]
  );
  if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');

  // Code uniqueness check (excluding self)
  if (body.code && body.code !== dept.code) {
    const exists = await db.queryOne(
      'SELECT dept_id FROM departments WHERE code = UPPER($1) AND college_id = $2 AND dept_id != $3',
      [body.code, req.user!.college_id, deptId]
    );
    if (exists) throw new AppError(409, 'Department code already in use', 'CODE_EXISTS');
  }

  const sets: string[] = []; const params: any[] = [];
  if (body.name) { params.push(body.name);             sets.push(`name = $${params.length}`); }
  if (body.code) { params.push(body.code.toUpperCase()); sets.push(`code = $${params.length}`); }
  if (!sets.length) throw new AppError(400, 'No fields to update', 'NO_CHANGES');

  params.push(deptId);
  const updated = await db.queryOne(
    `UPDATE departments SET ${sets.join(', ')} WHERE dept_id = $${params.length}
     RETURNING dept_id, name, code`,
    params
  );

  logger.info(`Department ${deptId} updated by admin ${req.user!.user_id}`);
  res.json({ success: true, data: updated });
}


// ─── DELETE DEPARTMENT ────────────────────────────────────────────────────────
// DELETE /api/admin/departments/:deptId
// HARD DELETE — cascades via DB foreign keys.
// The frontend already warns the admin when the dept has students/courses.
export async function deleteDepartment(req: AuthRequest, res: Response): Promise<void> {
  const { deptId } = req.params;

  const dept = await db.queryOne<any>(
    'SELECT dept_id, name FROM departments WHERE dept_id = $1 AND college_id = $2',
    [deptId, req.user!.college_id]
  );
  if (!dept) throw new AppError(404, 'Department not found', 'NOT_FOUND');

  await db.query('DELETE FROM departments WHERE dept_id = $1', [deptId]);

  logger.info(`Department ${deptId} (${dept.name}) deleted by admin ${req.user!.user_id}`);
  res.json({ success: true, message: `Department "${dept.name}" deleted.` });
}


// ─── BULK IMPORT DEPARTMENTS ──────────────────────────────────────────────────
// POST /api/admin/departments/bulk-import
// Body: Array<{ name: string; code: string }>
export async function bulkImportDepartments(req: AuthRequest, res: Response): Promise<void> {
  const rows = req.body;
  if (!Array.isArray(rows) || !rows.length)
    throw new AppError(400, 'Provide a non-empty array', 'INVALID_PAYLOAD');
  if (rows.length > 100)
    throw new AppError(400, 'Maximum 100 departments per import', 'TOO_MANY_ROWS');

  let imported = 0;
  const skipped: Array<{ code: string; reason: string }> = [];

  for (const row of rows) {
    const name = (row.name || '').toString().trim();
    const code = (row.code || '').toString().trim().toUpperCase();
    if (!name || !code) { skipped.push({ code: code||'?', reason: 'Missing name or code' }); continue; }

    const exists = await db.queryOne(
      'SELECT dept_id FROM departments WHERE code = $1 AND college_id = $2',
      [code, req.user!.college_id]
    );
    if (exists) { skipped.push({ code, reason: 'Code already exists' }); continue; }

    await db.query(
      'INSERT INTO departments (name, code, college_id) VALUES ($1, $2, $3)',
      [name, code, req.user!.college_id]
    );
    imported++;
  }

  logger.info(`Bulk import: ${imported} departments created by admin ${req.user!.user_id}`);
  res.json({ success: true, data: { imported, skipped } });
}

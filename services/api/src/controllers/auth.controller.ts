

import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { redis, RedisKeys } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken
} from '../utils/jwt';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import nodemailer from 'nodemailer'; // <-- Add this to your imports at the top
import { env } from '../config/env'; // Assuming you have an env config file, or use process.env

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────
const setPasswordSchema = z.object({
  identifier: z.string().min(2),        // email or roll_number/employee_code
  otp: z.string().length(6),
  new_password: z.string().min(8)
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(2)         // email OR roll_number OR employee_code
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// ─── HELPER: send OTP via email  ──────────────────────────────────────────────
async function sendOtpEmail(email: string, otp: string, name: string): Promise<void> {
  try {
    // 1. Create the transporter using environment variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 2. Define the email content with a clean HTML template
    const mailOptions = {
      from: `"SmartAttend" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Password Reset OTP - SmartAttend',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #1F4E79; margin-top: 0;">SmartAttend Password Reset</h2>
          <p style="color: #334155; font-size: 16px;">Hello <strong>${name}</strong>,</p>
          <p style="color: #334155; font-size: 16px;">We received a request to reset the password for your SmartAttend account.</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your One-Time Password</p>
            <h1 style="margin: 0; letter-spacing: 8px; color: #0f172a; font-size: 36px;">${otp}</h1>
          </div>
          
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            <strong>Note:</strong> This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email and your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Best regards,<br/>The SmartAttend Team</p>
        </div>
      `,
    };

    // 3. Send the email
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[OTP EMAIL] Sent successfully to: ${email} | Message ID: ${info.messageId}`);

  } catch (error) {
    logger.error(`[OTP EMAIL] Failed to send to ${email}:`, error);
    // Throwing the error ensures the calling function knows the email failed to send
    throw new Error('Failed to send OTP email. Please check the server email configuration.');
  }
}


export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body;
  if (!identifier) {
    throw new AppError(400, 'Identifier is required', 'MISSING_DATA');
  }

  logger.info(`Password reset requested for identifier: ${identifier}`);

  // Rate limit: max 3 OTP requests per identifier per 15 minutes
  const rateLimitKey = `otp:rate:${identifier}`;
  const attempts = await redis.incr(rateLimitKey);
  if (attempts === 1) await redis.expire(rateLimitKey, 15 * 60);
  if (attempts > 3) {
    throw new AppError(429, 'Too many OTP requests. Please wait 15 minutes.', 'RATE_LIMITED');
  }

  let recipientEmail = '';
  let recipientName = '';

  // 1. Try to find a fully registered User by Email
  const userRow = await db.queryOne<any>(
    `SELECT email, is_active, role FROM users WHERE LOWER(email) = LOWER($1)`,
    [identifier]
  );

  if (userRow) {
    // if this is admin then allow to reset password without checking is_active (since admin might have deactivated themselves by mistake and need to reset password to regain access)
    const isAdmin = userRow.role === 'ADMIN';
    
    if (!userRow.is_active && !isAdmin) throw new AppError(403, 'Account deactivated.', 'ACCOUNT_DEACTIVATED');
    recipientEmail = userRow.email;
    recipientName = recipientEmail.split('@')[0];
  } else {
    // 2. Try to find a Student by Roll Number (Registered OR Pending)
    const student = await db.queryOne<any>(
      `SELECT s.name, s.pending_email, u.email, u.is_active 
       FROM students s 
       LEFT JOIN users u ON u.user_id = s.user_id 
       WHERE s.roll_number = $1`,
      [identifier]
    );

    if (student) {
      if (student.email) {
        // Fully registered student
        if (student.is_active === false) throw new AppError(403, 'Account deactivated.', 'ACCOUNT_DEACTIVATED');
        recipientEmail = student.email;
      } else if (student.pending_email) {
        // PENDING student (Hasn't set up password yet)
        recipientEmail = student.pending_email;
      }
      recipientName = student.name;
    } else {
      // 3. Try to find a Professor by Employee Code (Registered OR Pending)
      const prof = await db.queryOne<any>(
        `SELECT p.name, p.pending_email, u.email, u.is_active 
         FROM professors p 
         LEFT JOIN users u ON u.user_id = p.user_id 
         WHERE p.employee_code = $1`,
        [identifier]
      );

      logger.info(`User lookup for forgot password (employee_code): ${prof ? 'FOUND' : 'NOT FOUND'}`);

      if (prof) {
        if (prof.email) {
          if (prof.is_active === false) throw new AppError(403, 'Account deactivated.', 'ACCOUNT_DEACTIVATED');
          recipientEmail = prof.email;
        } else if (prof.pending_email) {
          recipientEmail = prof.pending_email;
        }
        recipientName = prof.name;
      } else {
        // 2. Try to find a Student/professor by their pending_email (for those who haven't completed registration but want to reset password)
        const pendingRow = await db.queryOne<any>(
          `SELECT name, pending_email FROM (
       SELECT s.name, s.pending_email 
       FROM students s 
       WHERE s.pending_email = $1
       UNION
       SELECT p.name, p.pending_email 
       FROM professors p 
        WHERE p.pending_email = $1
      ) AS combined LIMIT 1`,
          [identifier]
        );
        if (pendingRow) {
         // if (!pendingRow.is_active) throw new AppError(403, 'Account deactivated.', 'ACCOUNT_DEACTIVATED');
          recipientEmail = pendingRow.pending_email;
          recipientName = pendingRow.name;
        }
      }
    }
  }



  // Generic success response to prevent enumeration attacks
  if (!recipientEmail) {
    res.json({ success: true, message: 'If this identifier is registered, you will receive an OTP.' });
    return;
  }

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate old OTPs for this identifier
  await db.query(
    `UPDATE otp_verifications SET used = TRUE WHERE identifier = $1 AND used = FALSE`,
    [identifier]
  );

  // Store new OTP
  await db.query(
    `INSERT INTO otp_verifications (identifier, otp_hash, purpose, expires_at)
     VALUES ($1, $2, 'PASSWORD_RESET', $3)`,
    [identifier, otpHash, expiresAt.toISOString()]
  );

  // Send the email
  await sendOtpEmail(recipientEmail, otp, recipientName);

  res.json({ success: true, message: 'If this identifier is registered, you will receive an OTP.' });
}

// ─── RESET PASSWORD — verify OTP and save new password ────────────────────────
// POST /api/auth/reset-password
// Body: { identifier, otp, new_password }
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { identifier, otp, new_password } = req.body;

  if (!identifier || !otp || !new_password) {
    throw new AppError(400, 'Missing required fields', 'MISSING_DATA');
  }

  // 1. Verify OTP
  const otpRecord = await db.queryOne<any>(
    `SELECT otp_id, otp_hash, expires_at FROM otp_verifications 
     WHERE identifier = $1 AND purpose = 'PASSWORD_RESET' AND used = FALSE 
     ORDER BY created_at DESC LIMIT 1`,
    [identifier]
  );

  if (!otpRecord) throw new AppError(400, 'Invalid or expired OTP', 'INVALID_OTP');
  if (new Date() > new Date(otpRecord.expires_at)) {
    throw new AppError(400, 'OTP has expired', 'OTP_EXPIRED');
  }

  const isValid = await bcrypt.compare(otp, otpRecord.otp_hash);
  if (!isValid) throw new AppError(400, 'Invalid OTP', 'INVALID_OTP');

  const passwordHash = await bcrypt.hash(new_password, 10);

  // 2. Determine who this is and update OR create their account

  // A. Check if they are already a fully registered user (by email)
  const userRow = await db.queryOne<any>(`SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)`, [identifier]);

  if (userRow) {
    // Normal Password Reset
    await db.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [passwordHash, userRow.user_id]);
  }
  else {
    // B. Check if they are a PENDING student (by roll number)
    let pendingStudent = await db.queryOne<any>(              // identifier could be roll_number or pending_email, so we check both in the query
      `SELECT s.student_id, s.pending_email, d.college_id 
       FROM students s 
       JOIN departments d ON s.dept_id = d.dept_id
       WHERE (s.roll_number = $1 OR s.pending_email = $1) AND s.user_id IS NULL`,
      [identifier]
    );

    if (pendingStudent) {
      // First-time setup: Insert into users, then link to students
      await db.query(
        `WITH new_user AS (
           INSERT INTO users (college_id, email, password_hash, role)
           VALUES ($1, $2, $3, 'STUDENT')
           RETURNING user_id
         )
         UPDATE students 
         SET user_id = (SELECT user_id FROM new_user), pending_email = NULL
         WHERE student_id = $4`,
        [pendingStudent.college_id, pendingStudent.pending_email, passwordHash, pendingStudent.student_id]
      );
    }
    else {
      // C. Check if they are a PENDING professor (by employee code)
      const pendingProf = await db.queryOne<any>(
        `SELECT p.professor_id, p.pending_email, d.college_id 
         FROM professors p 
         JOIN departments d ON p.dept_id = d.dept_id
         WHERE (p.employee_code = $1 OR p.pending_email = $1) AND p.user_id IS NULL`,
        [identifier]
      );

      if (pendingProf) {
        // First-time setup for professor
        await db.query(
          `WITH new_user AS (
             INSERT INTO users (college_id, email, password_hash, role)
             VALUES ($1, $2, $3, 'PROFESSOR')
             RETURNING user_id
           )
           UPDATE professors 
           SET user_id = (SELECT user_id FROM new_user), pending_email = NULL
           WHERE professor_id = $4`,
          [pendingProf.college_id, pendingProf.pending_email, passwordHash, pendingProf.professor_id]
        );
      } else {
        throw new AppError(404, 'User not found in system', 'NOT_FOUND');
      }
    }
  }

  // 3. Mark OTP as used
  await db.query(`UPDATE otp_verifications SET used = TRUE WHERE otp_id = $1`, [otpRecord.otp_id]);

  logger.info(`Password successfully set/reset for identifier: ${identifier}`);
  res.json({ success: true, message: 'Password updated successfully' });
}

// ─── REGISTER STUDENT ─────────────────────────────────────────────────────────
// POST /api/auth/register/student
// Now enforces: admin must have pre-registered the student first
// Body: { email, roll_number, password, college_id }
// (name, dept_id, semester come from admin's pre-registration)
const registerStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roll_number: z.string().min(2).max(20),
  college_id: z.string().uuid()
});

export async function registerStudent(req: Request, res: Response): Promise<void> {
  const body = registerStudentSchema.parse(req.body);

  const passwordCheck = validatePasswordStrength(body.password);
  if (!passwordCheck.valid) {
    throw new AppError(400, passwordCheck.message!, 'WEAK_PASSWORD');
  }

  // Check admin pre-registered this student (student row exists with no user_id yet)
  const preReg = await db.queryOne<any>(
    `SELECT s.student_id, s.name, s.dept_id, s.semester
     FROM students s
     LEFT JOIN users u ON u.user_id = s.user_id
     WHERE s.roll_number = $1 AND u.user_id IS NULL`,
    [body.roll_number]
  );

  if (!preReg) {
    throw new AppError(
      403,
      'You are not registered by the admin yet. Please contact your administrator to add you first.',
      'NOT_PRE_REGISTERED'
    );
  }

  // Check email matches what admin registered (if admin stored email)
  const adminEmail = await db.queryOne<any>(
    `SELECT pending_email FROM students WHERE student_id = $1`,
    [preReg.student_id]
  );
  // If admin stored email during pre-registration, verify it matches
  if (adminEmail?.pending_email && adminEmail.pending_email.toLowerCase() !== body.email.toLowerCase()) {
    throw new AppError(
      403,
      'Email does not match your registered email. Use the email your admin used to register you.',
      'EMAIL_MISMATCH'
    );
  }

  // Check duplicate email
  const emailTaken = await db.queryOne<any>(
    'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)',
    [body.email]
  );
  if (emailTaken) {
    throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
  }

  await db.transaction(async (client) => {
    const passwordHash = await hashPassword(body.password);

    const userResult = await client.query(
      `INSERT INTO users (college_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'STUDENT') RETURNING user_id`,
      [body.college_id, body.email.toLowerCase(), passwordHash]
    );
    const userId = userResult.rows[0].user_id;

    // Link user to pre-registered student row
    await client.query(
      'UPDATE students SET user_id = $1 WHERE student_id = $2',
      [userId, preReg.student_id]
    );
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully. Please login.'
  });
}

// ─── REGISTER PROFESSOR ───────────────────────────────────────────────────────
// POST /api/auth/register/professor
// Now enforces: admin must have pre-registered the professor first
const registerProfessorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  employee_code: z.string().min(2).max(20),
  college_id: z.string().uuid()
});

export async function registerProfessor(req: Request, res: Response): Promise<void> {
  const body = registerProfessorSchema.parse(req.body);

  const passwordCheck = validatePasswordStrength(body.password);
  if (!passwordCheck.valid) {
    throw new AppError(400, passwordCheck.message!, 'WEAK_PASSWORD');
  }

  // Check admin pre-registered this professor
  const preReg = await db.queryOne<any>(
    `SELECT p.professor_id, p.name, p.dept_id
     FROM professors p
     LEFT JOIN users u ON u.user_id = p.user_id
     WHERE p.employee_code = $1 AND u.user_id IS NULL`,
    [body.employee_code]
  );

  if (!preReg) {
    throw new AppError(
      403,
      'You are not registered by the admin yet. Please contact your administrator to add you first.',
      'NOT_PRE_REGISTERED'
    );
  }

  // Check email matches admin record if stored
  const adminEmail = await db.queryOne<any>(
    `SELECT pending_email FROM professors WHERE professor_id = $1`,
    [preReg.professor_id]
  );
  if (adminEmail?.pending_email && adminEmail.pending_email.toLowerCase() !== body.email.toLowerCase()) {
    throw new AppError(
      403,
      'Email does not match your registered email. Use the email your admin used to register you.',
      'EMAIL_MISMATCH'
    );
  }

  const emailTaken = await db.queryOne<any>(
    'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)',
    [body.email]
  );
  if (emailTaken) {
    throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
  }

  await db.transaction(async (client) => {
    const passwordHash = await hashPassword(body.password);

    const userResult = await client.query(
      `INSERT INTO users (college_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'PROFESSOR') RETURNING user_id`,
      [body.college_id, body.email.toLowerCase(), passwordHash]
    );
    const userId = userResult.rows[0].user_id;

    await client.query(
      'UPDATE professors SET user_id = $1 WHERE professor_id = $2',
      [userId, preReg.professor_id]
    );
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully. Please login.'
  });
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);

  const user = await db.queryOne<any>(
    `SELECT u.user_id, u.email, u.password_hash, u.role, u.college_id, u.is_active
     FROM users u WHERE LOWER(u.email) = LOWER($1)`,
    [body.email]
  );


  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw new AppError(403, 'Account is deactivated. Contact admin.', 'ACCOUNT_DEACTIVATED');
  }


  const passwordMatch = await verifyPassword(body.password, user.password_hash);
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const tokenPayload = {
    user_id: user.user_id,
    role: user.role,
    college_id: user.college_id,
    email: user.email
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  await storeRefreshToken(user.user_id, refreshToken);

  let profile = null;
  if (user.role === 'STUDENT') {
    profile = await db.queryOne(
      'SELECT student_id, name, roll_number, semester, face_enrolled_at FROM students WHERE user_id = $1',
      [user.user_id]
    );
  } else if (user.role === 'PROFESSOR') {
    profile = await db.queryOne(
      'SELECT professor_id, name, employee_code FROM professors WHERE user_id = $1',
      [user.user_id]
    );
  }

  // set is_active in device_bindings  -- problem, suppose admin has deactivated the account but user can logged in as device_bindings is_active is not checked during login, only in attendance marking, so user can login and get tokens but can't mark attendance, is that acceptable? or should we also check device_bindings.is_active during login and prevent login if all bindings are inactive?
  await db.query(
    'UPDATE device_bindings SET is_active = TRUE WHERE user_id = $1',
    [user.user_id]
  );

  res.json({
    success: true,
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        college_id: user.college_id,
        ...profile
      }
    }
  });
}

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refresh_token, user_id } = req.body;

  if (!refresh_token || !user_id) {
    throw new AppError(400, 'refresh_token and user_id required', 'MISSING_FIELDS');
  }

  const payload = await validateRefreshToken(user_id, refresh_token);
  if (!payload) {
    throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);
  await storeRefreshToken(payload.user_id, newRefreshToken);

  res.json({
    success: true,
    data: { access_token: newAccessToken, refresh_token: newRefreshToken }
  });
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  const { user_id } = req.body;
  if (user_id) {
    await revokeRefreshToken(user_id);
  }
  res.json({ success: true, message: 'Logged out successfully' });
}
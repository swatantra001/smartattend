import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error.middleware';
import { db } from '../config/database';
import { UserRole } from '@smartattend/shared';


export interface AuthRequest extends Request {
  user?: {
    user_id: string;
    role: UserRole;
    college_id: string;
    email: string;
  };
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'No token provided', 'NO_TOKEN'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    req.user = {
      user_id: payload.user_id,
      role: payload.role,
      college_id: payload.college_id,
      email: payload.email
    };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token expired', 'TOKEN_EXPIRED'));
    }
    return next(new AppError(401, 'Invalid token', 'INVALID_TOKEN'));
  }
}

export function requireRole(...roles: (UserRole | string)[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    next();
  };
}

// Attach full student/professor profile to request
export async function attachProfile(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) return next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));

  try {
    if (req.user.role === 'STUDENT') {
      const student = await db.queryOne(
        'SELECT * FROM students WHERE user_id = $1',
        [req.user.user_id]
      );
      (req as any).student = student;
    } else if (req.user.role === 'PROFESSOR') {
      const professor = await db.queryOne(
        'SELECT * FROM professors WHERE user_id = $1',
        [req.user.user_id]
      );
      (req as any).professor = professor;
    }
    next();
  } catch (err) {
    next(err);
  }
}
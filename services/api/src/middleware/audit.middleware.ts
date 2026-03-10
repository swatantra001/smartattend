import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { db } from '../config/database';
import { logger } from '../config/logger';

export function auditLog(action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Log after response
    res.on('finish', async () => {
      if (res.statusCode >= 400) return; // only log successful actions
      try {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, metadata, ip_address)
           VALUES ($1, $2, $3, $4)`,
          [
            req.user?.user_id ?? null,
            action,
            JSON.stringify({ method: req.method, url: req.url, body: sanitizeBody(req.body) }),
            req.ip
          ]
        );
      } catch (err) {
        logger.error('Audit log error:', err);
      }
    });
    next();
  };
}

function sanitizeBody(body: any): any {
  if (!body) return {};
  const sensitive = ['password', 'password_hash', 'token', 'secret', 'face_embedding'];
  const sanitized = { ...body };
  for (const key of sensitive) {
    if (key in sanitized) sanitized[key] = '[REDACTED]';
  }
  return sanitized;
}
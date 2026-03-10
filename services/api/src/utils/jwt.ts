import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redis, RedisKeys } from '../config/redis';
import { UserRole } from '@smartattend/shared';

interface TokenPayload {
  user_id: string;
  role: UserRole;
  college_id: string;
  email: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
    issuer: 'smartattend'
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    issuer: 'smartattend'
  });
}

export async function storeRefreshToken(
  userId: string,
  refreshToken: string
): Promise<void> {
  // 7 days in seconds
  await redis.setex(RedisKeys.refreshToken(userId), 60 * 60 * 24 * 7, refreshToken);
}

export async function validateRefreshToken(
  userId: string,
  token: string
): Promise<TokenPayload | null> {
  const stored = await redis.get(RedisKeys.refreshToken(userId));
  if (!stored || stored !== token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as any;
    return {
      user_id: payload.user_id,
      role: payload.role,
      college_id: payload.college_id,
      email: payload.email
    };
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(userId: string): Promise<void> {
  await redis.del(RedisKeys.refreshToken(userId));
}
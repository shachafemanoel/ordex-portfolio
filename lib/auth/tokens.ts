import jwt from 'jsonwebtoken';

import { authConfig } from '@/lib/auth/config';
import type { SessionPayload, SessionUser } from '@/lib/auth/types';

export function createSessionToken(user: SessionUser, maxAgeSeconds: number): string {
  const { jwtSecret, jwtIssuer, jwtAudience } = authConfig;

  if (!jwtSecret) {
    throw new Error('AUTH_JWT_SECRET must be configured');
  }

  const payload = {
    tenantId: user.tenantId,
    sessionVersion: user.sessionVersion ?? 0,
    email: user.email,
    role: user.role,
    name: user.name ?? null,
  } satisfies Partial<SessionPayload>;

  return jwt.sign(payload, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: maxAgeSeconds,
    issuer: jwtIssuer,
    audience: jwtAudience,
    subject: user.id,
  });
}

export function verifySessionToken(token: string): SessionPayload {
  const { jwtSecret, jwtIssuer, jwtAudience } = authConfig;

  if (!jwtSecret) {
    throw new Error('AUTH_JWT_SECRET must be configured');
  }

  const decoded = jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
    audience: jwtAudience,
    issuer: jwtIssuer,
  }) as jwt.JwtPayload;

  if (!decoded.sub || typeof decoded.sub !== 'string') {
    throw new Error('Invalid session payload');
  }

  return {
    sub: decoded.sub,
    sessionVersion: typeof decoded.sessionVersion === 'number' ? decoded.sessionVersion : 0,
    tenantId: typeof decoded.tenantId === 'string' ? decoded.tenantId : undefined,
    email: String(decoded.email ?? ''),
    role: decoded.role as SessionPayload['role'],
    iss: String(decoded.iss ?? jwtIssuer),
    aud: Array.isArray(decoded.aud) ? decoded.aud[0]! : String(decoded.aud ?? jwtAudience),
    iat: Number(decoded.iat ?? Math.floor(Date.now() / 1000)),
    exp: Number(decoded.exp ?? Math.floor(Date.now() / 1000)),
    name: decoded.name as string | null | undefined,
  };
}

import { normalizeEmail } from '@/lib/auth/normalization';

const DEFAULT_ADMIN_EMAIL_FALLBACK = 'admin@ordex.local';
const DEFAULT_ADMIN_PASSWORD_FALLBACK = 'ChangeMe123!';
const DEFAULT_ADMIN_NAME_FALLBACK = 'Ordex Administrator';

const env = typeof process !== 'undefined' ? process.env : undefined;

function pickEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function getDefaultAdminEmail(): string {
  const email =
    pickEnv('DEFAULT_ADMIN_EMAIL', 'ADMIN_EMAIL', 'NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL') ??
    DEFAULT_ADMIN_EMAIL_FALLBACK;

  return normalizeEmail(email);
}

export function getDefaultAdminPassword(): string {
  const envPassword = pickEnv('DEFAULT_ADMIN_PASSWORD', 'ADMIN_PASSWORD');

  if (process.env.NODE_ENV === 'production' && !envPassword) {
    throw new Error(
      'In production, DEFAULT_ADMIN_PASSWORD or ADMIN_PASSWORD must be set. Using fallback password is not allowed.'
    );
  }

  const password = envPassword ?? DEFAULT_ADMIN_PASSWORD_FALLBACK;

  if (password.length < 8) {
    throw new Error('DEFAULT_ADMIN_PASSWORD must be at least 8 characters long');
  }

  return password;
}

export function getDefaultAdminName(): string {
  return pickEnv('DEFAULT_ADMIN_NAME') ?? DEFAULT_ADMIN_NAME_FALLBACK;
}

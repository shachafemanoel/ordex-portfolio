const DEFAULT_SESSION_COOKIE_NAME = 'ordex.sid';

const env = typeof process !== 'undefined' ? process.env : undefined;

function sanitizeCookieName(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const configuredSessionCookieName = sanitizeCookieName(env?.SESSION_COOKIE_NAME);
export const SESSION_COOKIE_NAME = configuredSessionCookieName ?? DEFAULT_SESSION_COOKIE_NAME;

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const authConfig = {
  jwtSecret: env?.AUTH_JWT_SECRET ?? env?.JWT_SECRET ?? '',
  jwtIssuer: env?.AUTH_JWT_ISS ?? 'ordex',
  jwtAudience: env?.AUTH_JWT_AUD ?? 'ordex-app',
  sessionMaxAge: parseInteger(env?.AUTH_SESSION_MAX_AGE, 60 * 60),
  rememberMaxAge: parseInteger(env?.AUTH_REMEMBER_MAX_AGE, 14 * 24 * 60 * 60),
};

const isBuildPhase =
  process.env.DOCKER_BUILD === 'true' ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.SKIP_DB_ON_BUILD === 'true' ||
  process.env.SKIP_ENV_VALIDATION === 'true';

if (!isBuildPhase && (!authConfig.jwtSecret || authConfig.jwtSecret.length < 32)) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_JWT_SECRET must be set to a 32+ character random string in production. ' +
        'Generate one with: openssl rand -base64 32'
    );
  } else {
    console.warn(
      'AUTH_JWT_SECRET is missing or too short. Set a 32+ byte secret in the environment for secure cookies.'
    );
  }
}

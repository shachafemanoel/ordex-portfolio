import { z } from 'zod';

// Critical environment variables required for app boot
const coreEnvSchema = z.object({
  DATABASE_URL: process.env.SKIP_ENV_VALIDATION
    ? z.string().optional()
    : z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.string().default('production'),
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_API_BASE: z.string().default('/api'),
  TIMEZONE: z.string().default('Asia/Jerusalem'),
  SKIP_ENV_VALIDATION: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  JWT_SECRET: process.env.SKIP_ENV_VALIDATION
    ? z.string().optional()
    : z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_REFRESH_SECRET: process.env.SKIP_ENV_VALIDATION
    ? z.string().optional()
    : z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters').optional(),
});

// Feature-specific environment variable schemas (validated lazily)
export const featureEnvSchemas = {
  // OmniSupply AI Integration
  aiIntegration: z.object({
    OMNISUPPLY_API_URL: z.string().url().optional(),
    OMNISUPPLY_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default('gpt-4o-mini'),
    AI_MODEL_TEMPERATURE: z.coerce.number().default(0.7),
    AI_MODEL_MAX_TOKENS: z.coerce.number().default(2000),
    AI_AGENT_TIMEOUT_MS: z.coerce.number().default(30000),
    AI_MAX_RETRIES: z.coerce.number().default(3),
    ENABLE_AI_RISK_ASSESSMENT: z.string().optional(),
    ENABLE_AI_FINANCIAL_ADVICE: z.string().optional(),
  }),
  cors: z.object({
    ALLOWED_ORIGINS: z.string().optional(),
  }),

  redis: z.object({
    REDIS_URL: z.string().url().optional(),
    REDIS_PUBLIC_URL: z.string().url().optional(),
  }),

  googleCalendar: z
    .object({
      GCAL_SERVICE_ACCOUNT_EMAIL: z
        .string()
        .email('Google Calendar Service Account Email must be valid')
        .optional(),
      GCAL_SERVICE_ACCOUNT_KEY_BASE64: z
        .string()
        .min(1, 'Google Calendar Service Account Key is required')
        .optional(),
      GCAL_CALENDAR_ID: z.string().min(1, 'Google Calendar ID is required').optional(),
      // Legacy support for GOOGLE_* variables
      GOOGLE_CLIENT_EMAIL: z.string().email('Google Client Email must be valid').optional(),
      GOOGLE_PRIVATE_KEY: z.string().min(1, 'Google Private Key is required').optional(),
      GOOGLE_CALENDAR_ID: z.string().min(1, 'Google Calendar ID is required').optional(),
    })
    .refine(
      (data) => {
        // At least one set of credentials must be provided
        const hasGcalCreds =
          data.GCAL_SERVICE_ACCOUNT_EMAIL &&
          data.GCAL_SERVICE_ACCOUNT_KEY_BASE64 &&
          data.GCAL_CALENDAR_ID;
        const hasGoogleCreds =
          data.GOOGLE_CLIENT_EMAIL && data.GOOGLE_PRIVATE_KEY && data.GOOGLE_CALENDAR_ID;
        return hasGcalCreds || hasGoogleCreds;
      },
      {
        message: 'Either GCAL_* or GOOGLE_* credentials must be provided for Calendar integration',
      }
    ),

  mapbox: z.object({
    MAPBOX: z.string().min(1, 'Mapbox access token is required').optional(),
    NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1, 'Mapbox public token').optional(),
    MAPBOX_STYLE_ID: z.string().optional(),
  }),

  geminiAI: z.object({
    GEMINI_API_KEY: z.string().min(1, 'Gemini API Key is required for AI features'),
  }),

  twilio: z.object({
    TWILIO_ACCOUNT_SID: z.string().min(1, 'Twilio Account SID is required'),
    TWILIO_AUTH_TOKEN: z.string().min(1, 'Twilio Auth Token is required'),
    TWILIO_FROM_NUMBER: z.string().min(1, 'Twilio From Number is required'),
  }),

  whatsapp: z.object({
    WHATSAPP_TOKEN: z.string().min(1, 'WhatsApp Token is required'),
    WHATSAPP_PHONE_ID: z.string().min(1, 'WhatsApp Phone ID is required'),
    WHATSAPP_BUSINESS_ID: z.string().min(1, 'WhatsApp Business ID is required'),
  }),

  encryption: z.object({
    ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  }),

  woocommerce: z.object({
    WOOCOMMERCE_STORE_URL: z.string().url('WooCommerce Store URL must be a valid URL'),
    WOOCOMMERCE_KEY: z.string().min(1, 'WooCommerce Consumer Key is required'),
    WOOCOMMERCE_PASSWORD: z.string().min(1, 'WooCommerce Consumer Secret is required'),
  }),

  integrations: z.object({
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    /** Full callback URL, e.g. https://app.example.com/api/integrations/google/callback */
    GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
    STRIPE_CLIENT_ID: z.string().optional(),
    STRIPE_CLIENT_SECRET: z.string().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    SENDGRID_API_KEY: z.string().optional(),
    CLOUDINARY_URL: z.string().optional(),
  }),

  scheduling: z.object({
    CRON_KEY: z.string().optional(),
  }),
} as const;

type FeatureName = keyof typeof featureEnvSchemas;

// Cache for validated feature environments
const featureEnvCache = new Map<FeatureName, any>();

// Core environment (validated at startup)
let coreEnv: z.infer<typeof coreEnvSchema>;

const isServer = typeof window === 'undefined';

if (isServer) {
  const isBuildPhaseEnv =
    process.env.SKIP_ENV_VALIDATION === 'true' ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.DOCKER_BUILD === 'true';

  try {
    coreEnv = coreEnvSchema.parse(process.env);
  } catch (error) {
    if (process.env.NODE_ENV === 'production' && !isBuildPhaseEnv) {
      // In production, fail hard - do not silently fall back to wrong database
      throw new Error(
        'Core environment validation failed. Ensure DATABASE_URL and AUTH_JWT_SECRET are set. ' +
          (error instanceof Error ? error.message : String(error))
      );
    }

    if (!isBuildPhaseEnv) {
      console.warn(
        '⚠ Core environment validation failed (non-production):',
        error instanceof z.ZodError
          ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
          : String(error)
      );
    }

    // Build phase or development: provide minimal defaults
    coreEnv = {
      DATABASE_URL: process.env.DATABASE_URL || '',
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: 3000,
      NEXT_PUBLIC_API_BASE: '/api',
      TIMEZONE: 'Asia/Jerusalem',
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    };
  }
} else {
  // Client-side fallback: Do not validate server-side vars (like DATABASE_URL)
  coreEnv = {
    DATABASE_URL: '', // Not available on client
    NODE_ENV: process.env.NODE_ENV || 'production',
    PORT: 3000,
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || '/api',
    TIMEZONE: 'Asia/Jerusalem',
    SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
    GOOGLE_CALENDAR_ID: undefined,
    JWT_SECRET: undefined,
    JWT_REFRESH_SECRET: undefined,
  } as any;
}

// Check if we're in build phase
const isBuildPhase =
  process.env.DOCKER_BUILD === 'true' ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.SKIP_DB_ON_BUILD === 'true' ||
  process.env.SKIP_ENV_VALIDATION === 'true';

const authSecret = process.env.AUTH_JWT_SECRET;
if (!isBuildPhase && (!authSecret || authSecret.length < 32)) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_JWT_SECRET is missing or too short (min 32 chars). Generate one: openssl rand -base64 32'
    );
  } else {
    console.warn(
      '⚠ AUTH_JWT_SECRET is missing or too short. Auth will not work until this is set.'
    );
  }
}

// Utility function to require a specific environment variable
export function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

// Utility function to get an optional environment variable
export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] || fallback;
}

// Lazily validate and cache feature-specific environment variables
export function requireFeatureEnv<T extends FeatureName>(
  featureName: T
): z.infer<(typeof featureEnvSchemas)[T]> {
  if (featureEnvCache.has(featureName)) {
    return featureEnvCache.get(featureName);
  }

  try {
    const schema = featureEnvSchemas[featureName];
    const validated = schema.parse(process.env);
    featureEnvCache.set(featureName, validated);
    return validated;
  } catch (error) {
    const zodError = error as z.ZodError;
    const errorMessage = zodError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Feature '${featureName}' environment validation failed: ${errorMessage}`);
  }
}

// Check if a feature is properly configured
export function isFeatureConfigured(featureName: FeatureName): boolean {
  try {
    requireFeatureEnv(featureName);
    return true;
  } catch {
    return false;
  }
}

// Get feature environment safely (returns null if not configured)
export function getFeatureEnv<T extends FeatureName>(
  featureName: T
): z.infer<(typeof featureEnvSchemas)[T]> | null {
  try {
    return requireFeatureEnv(featureName);
  } catch {
    return null;
  }
}

// Export the validated core environment
export const env = coreEnv;

// Environment utilities for common patterns
export const isDevelopment = coreEnv.NODE_ENV === 'development';
export const isProduction = coreEnv.NODE_ENV === 'production';
export const isTest = coreEnv.NODE_ENV === 'test';

// Database connection utilities
export function getDatabaseUrl(): string {
  const url = coreEnv.DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return url;
}

// Redis connection utilities
export function getRedisUrl(): string | null {
  const redisEnv = getFeatureEnv('redis');
  return redisEnv?.REDIS_URL || redisEnv?.REDIS_PUBLIC_URL || null;
}

// Health check for environment configuration
export function validateEnvironmentHealth(): {
  core: { valid: boolean; errors?: string[] };
  features: Record<FeatureName, { configured: boolean; valid: boolean; errors?: string[] }>;
} {
  const result: any = {
    core: { valid: true },
    features: {},
  };

  // Check core environment
  try {
    coreEnvSchema.parse(process.env);
  } catch (error) {
    const zodError = error as z.ZodError;
    result.core = {
      valid: false,
      errors: zodError.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  // Check each feature
  for (const featureName of Object.keys(featureEnvSchemas) as FeatureName[]) {
    const configured = isFeatureConfigured(featureName);
    result.features[featureName] = {
      configured,
      valid: configured,
    };

    if (!configured) {
      try {
        requireFeatureEnv(featureName);
      } catch (error) {
        result.features[featureName].errors = [
          error instanceof Error ? error.message : String(error),
        ];
      }
    }
  }

  return result;
}

import { getFeatureEnv } from '@/lib/envConfig';
import { GoogleOAuthConfigError } from '@/lib/integrations/google/errors';

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

export function getGoogleOAuthClientConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const integrations = getFeatureEnv('integrations');
  const clientId = integrations?.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = integrations?.GOOGLE_CLIENT_SECRET?.trim();
  const explicitRedirect = integrations?.GOOGLE_OAUTH_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret) {
    throw new GoogleOAuthConfigError();
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : '') ||
    'http://localhost:3000';

  const redirectUri =
    explicitRedirect || `${base}/api/integrations/google/callback`;

  return { clientId, clientSecret, redirectUri };
}

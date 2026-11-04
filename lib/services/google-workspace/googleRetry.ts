import { GoogleRateOrTransientError } from '@/lib/integrations/google/errors';

const DELAYS_MS = [250, 1000, 4000];

function isRetryableGoogleError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: number | string })?.code;
  if (code === 400 || code === '400') return false;
  if (/invalid_grant|invalid_?argument|invalid email|malformed/i.test(msg)) return false;
  return (
    code === 429 ||
    code === '429' ||
    /429|5\d\d|ECONNRESET|ETIMEDOUT|socket hang up|quota|rate/i.test(msg)
  );
}

export async function withGoogleRetries<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRetryableGoogleError(e) || attempt === DELAYS_MS.length) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, DELAYS_MS[attempt]));
    }
  }
  throw last instanceof Error ? last : new GoogleRateOrTransientError(String(last));
}

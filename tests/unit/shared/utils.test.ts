import { describe, it, expect, vi, afterEach } from 'vitest';
import { createUrl } from '@/src/shared/utils';

describe('src/shared/utils', () => {
  describe('createUrl', () => {
    it('returns the same URL object if a URL instance is passed', () => {
      const url = new URL('https://example.com');
      const result = createUrl(url);
      expect(result).toBe(url);
      expect(result.href).toBe('https://example.com/');
    });

    it('handles absolute http URLs correctly', () => {
      const path = 'http://example.com/test';
      const result = createUrl(path);
      expect(result).toBeInstanceOf(URL);
      expect(result.href).toBe('http://example.com/test');
    });

    it('handles absolute https URLs correctly', () => {
      const path = 'https://example.com/test';
      const result = createUrl(path);
      expect(result).toBeInstanceOf(URL);
      expect(result.href).toBe('https://example.com/test');
    });

    it('handles absolute URLs case-insensitively', () => {
      const path = 'HTTPS://EXAMPLE.COM/TEST';
      const result = createUrl(path);
      expect(result).toBeInstanceOf(URL);
      expect(result.href).toBe('https://example.com/TEST');
    });

    describe('relative paths and base URL', () => {
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('uses NEXT_PUBLIC_APP_URL as base if available', () => {
        const baseUrl = 'https://app.example.com';
        vi.stubEnv('NEXT_PUBLIC_APP_URL', baseUrl);
        vi.stubEnv('VERCEL_URL', '');

        const path = '/api/v1/resource';
        const result = createUrl(path);

        expect(result.href).toBe('https://app.example.com/api/v1/resource');
      });

      it('uses VERCEL_URL as base if available and NEXT_PUBLIC_APP_URL is not', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        vi.stubEnv('VERCEL_URL', 'preview.vercel.app');

        const path = '/api/v1/resource';
        const result = createUrl(path);

        // getBaseUrl prepends https:// to VERCEL_URL
        expect(result.href).toBe('https://preview.vercel.app/api/v1/resource');
      });

      it('falls back to localhost:3000 if no env vars are set', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        vi.stubEnv('VERCEL_URL', '');

        const path = '/api/v1/resource';
        const result = createUrl(path);

        expect(result.href).toBe('http://localhost:3000/api/v1/resource');
      });

      it('handles relative paths without leading slash', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        vi.stubEnv('VERCEL_URL', '');

        const path = 'api/v1/resource';
        const result = createUrl(path);

        // URL constructor with base 'http://localhost:3000' and 'api/v1/resource'
        // will result in 'http://localhost:3000/api/v1/resource'
        expect(result.href).toBe('http://localhost:3000/api/v1/resource');
      });
    });
  });
});

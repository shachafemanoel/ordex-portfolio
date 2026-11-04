/**
 * Adds sslmode=require to remote PostgreSQL URLs that do not set one.
 * Local development databases normally run without TLS, so localhost URLs are left as-is.
 */
export function withSslModeRequire(url: string | undefined | null): string | undefined {
  if (!url) return url ?? undefined;
  if (!/^postgres/i.test(url)) return url;
  if (/([?&])sslmode=/i.test(url)) return url;
  if (/@(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) return url;
  return url.includes('?') ? `${url}&sslmode=require` : `${url}?sslmode=require`;
}

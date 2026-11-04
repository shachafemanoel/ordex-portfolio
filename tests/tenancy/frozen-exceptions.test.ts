import exceptions from '@/docs/release/frozen-test-exceptions.json';
import { isMvpApiAllowed } from '@/lib/tenancy/mvp-routes';
import { describe, expect, it } from 'vitest';
describe('each proposed historical exception has a blocked server surface', () => {
  it('does not list the same test twice', () =>
    expect(new Set(exceptions.exceptions.map((row) => row.test)).size).toBe(
      exceptions.exceptions.length
    ));
  for (const row of exceptions.exceptions)
    it(row.test, () => {
      expect(row.frozenModule.length).toBeGreaterThan(5);
      expect(row.reason.length).toBeGreaterThan(30);
      expect(row.serverPaths.length).toBeGreaterThan(0);
      for (const path of row.serverPaths)
        for (const method of row.methods)
          expect(isMvpApiAllowed(path, method), `${path} ${method}`).toBe(false);
    });
});

import { expect, test } from '@playwright/test';
import exceptions from '../../docs/release/frozen-test-exceptions.json';
test('every proposed historical exception is blocked by the deployed server entry point', async ({
  request,
}) => {
  const cases = new Set(
    exceptions.exceptions.flatMap((row) =>
      row.serverPaths.flatMap((path) => row.methods.map((method) => `${method} ${path}`))
    )
  );
  for (const entry of cases) {
    const [method, path] = entry.split(' ');
    const response = await request.fetch(path, { method });
    expect(response.status(), entry).toBe(404);
    const body = await response.json();
    expect(body.error?.code, entry).toBe('FEATURE_UNAVAILABLE');
  }
});

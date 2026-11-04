import { defineConfig } from 'vitest/config';
import exceptions from './docs/release/frozen-test-exceptions.json';
import base from './vitest.config';

// Full active surface, not a hand-picked passing-test allowlist. Every excluded historical file
// has a reason and a server boundary proven by unit and actual HTTP acceptance checks.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    exclude: [...(base.test?.exclude ?? []), ...exceptions.exceptions.map((row) => row.test)],
  },
});

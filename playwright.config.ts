import { defineConfig } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';

const isSmokeRun = process.argv.some((arg) => arg.includes('tests/e2e/smoke.spec.ts'));
const hasEnvTestFile = existsSync('.env.test');

if (isSmokeRun) {
  loadDotenv({ path: '.env.test' });
}

if (!process.env.DATABASE_URL && (!isSmokeRun || !hasEnvTestFile)) {
  loadDotenv({ path: '.env' });
}

export default defineConfig({
  testDir: '.',
  testMatch: ['playwright/tests/**/*.spec.ts', 'tests/e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.tsx'],
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

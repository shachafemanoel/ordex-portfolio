import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env.DEMO_TEST_URL || 'http://127.0.0.1:4177', locale: 'he-IL' },
  webServer: process.env.DEMO_TEST_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 4177 --strictPort',
        url: 'http://127.0.0.1:4177',
        reuseExistingServer: true,
      },
});

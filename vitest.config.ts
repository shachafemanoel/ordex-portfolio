import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/lib\/db$/, replacement: path.resolve(__dirname, 'tests/mocks/db.ts') },
      { find: '@/lib/telemetry', replacement: path.resolve(__dirname, 'src/lib/telemetry') },
      { find: '@/domain', replacement: path.resolve(__dirname, 'domain') },
      { find: '@/services', replacement: path.resolve(__dirname, 'services') },
      { find: '@/repos', replacement: path.resolve(__dirname, 'src/repos') },
      { find: '@/config', replacement: path.resolve(__dirname, 'src/config') },
      { find: '@/ui', replacement: path.resolve(__dirname, 'src/ui') },
      { find: '@/src', replacement: path.resolve(__dirname, 'src') },
      { find: '@', replacement: path.resolve(__dirname, '.') },
    ],
  },
  test: {
    // Override DATABASE_URL for tests to prevent connection to production DB
    env: {
      NODE_ENV: 'test',
      // Allow overriding via shell; fall back to a safe local URL when not provided.
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://127.0.0.1:5432/ordex_test?schema=public',
      SKIP_PRISMA_INIT: process.env.TEST_DATABASE_URL ? 'false' : 'true',
      SKIP_DB_TESTS: process.env.SKIP_DB_TESTS || 'true',
    },
    // Run tests only in the root `tests` directory
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    // Exclude everything in oms-backend and other common folders
    exclude: [
      'oms-backend/**',
      'tests/e2e/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    // Use setupFiles to load the environment variables before tests run
    setupFiles: ['./tests/setup.ts'],
    // Test environment configuration
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/e2e/**/*.spec.ts?(x)', 'jsdom'],
      ['tests/components/**/*.{test,spec}.ts?(x)', 'jsdom'],
      ['tests/unit/components/**/*.{test,spec}.ts?(x)', 'jsdom'],
    ],
    globalSetup: ['./vitest.global-setup.ts'],
    globals: true,
    // Test execution settings
    testTimeout: 30000,
    hookTimeout: 30000,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        '**/[.]**',
        'packages/*/test?(s)/**',
        '**/*.d.ts',
        '**/virtual:*',
        '**/__x00__*',
        '**/\x00*',
        'cypress/**',
        'test?(s)/**',
        'test?(-*).?(c|m)[jt]s?(x)',
        '**/*{.,-}{test,spec}.?(c|m)[jt]s?(x)',
        '**/__tests__/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/vitest.config.*',
        '.next/**',
        'scripts/**',
        'prisma/**',
        'public/**',
        'workers/**',
        'tailwind.config.js',
        'next.config.js',
        'postcss.config.js',
      ],
      // Coverage thresholds - fail if coverage is below these percentages
      thresholds: {
        global: {
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70,
        },
      },
      // Only collect coverage from source files
      include: [
        'app/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/layout.tsx',
        '!**/loading.tsx',
        '!**/not-found.tsx',
        '!**/error.tsx',
        '!**/global-error.tsx',
      ],
    },
    // Reporter configuration
    outputFile: {
      json: './coverage/test-results.json',
      junit: './coverage/junit.xml',
    },
  },
});

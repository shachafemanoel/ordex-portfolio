import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'prefer-const': 'warn',
      'no-var': 'warn',
      'object-shorthand': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['features/*/components/*', 'features/*/hooks/*', 'features/*/utils/*'],
              message:
                "Import from feature barrel (index.ts) only. Use: import { Component } from 'features/module'",
            },
            {
              group: ['../../features/*', '../../../features/*'],
              message:
                'Features cannot import from other features. Extract shared logic to shared/lib/',
            },
            {
              group: ['**/components/index', '**/hooks/index', '**/utils/index'],
              message:
                'No nested barrel exports allowed. Only feature-level and shared/ui barrels permitted.',
            },
            {
              group: ['shared/ui/*/'],
              message: "Import from shared/ui barrel only. Use: import { Card } from 'shared/ui'",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'scripts/**',
      'tests/**',
      'ordex-preview/**',
      'legacy/**',
      'agents/**',
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.gemini/**',
      'ai/.agent/**',
    ],
  },
];

export default config;

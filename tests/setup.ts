import { vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom/vitest';

if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 32) {
  process.env.AUTH_JWT_SECRET = 'test-auth-jwt-secret-32-bytes-minimum!';
}

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');

  class PrismaClientCompat extends actual.PrismaClient {
    constructor(options: any = {}) {
      if (options?.datasources?.db?.url && !options.datasourceUrl) {
        options = { ...options, datasourceUrl: options.datasources.db.url };
        delete options.datasources;
      }
      super(options);
    }
  }

  return {
    ...actual,
    PrismaClient: PrismaClientCompat,
    Role: {
      ADMIN: 'ADMIN',
      USER: 'USER',
    },
  };
});

vi.mock('@/lib/api-middleware', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requirePermissions: () => true,
    requireRole: () => true,
  };
});

(global as any).React = React;

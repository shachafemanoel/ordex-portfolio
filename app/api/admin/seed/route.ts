export const dynamic = 'force-dynamic';

import { createSuccessResponse, handleApiError, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth';
import { exec } from 'child_process';
import { NextRequest } from 'next/server';
import { promisify } from 'util';
import { z } from 'zod';

const execAsync = promisify(exec);

const SeedRequestSchema = z.object({
  type: z.enum(['main', 'redis', 'warm', 'demo', 'complete', 'full']).optional().default('full'),
});

/**
 * Admin endpoint to trigger database seeding
 * POST /api/admin/seed
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser) => {
    try {
      const body = await req.json().catch(() => ({}));
      const parsed = SeedRequestSchema.safeParse(body);

      if (!parsed.success) {
        return handleApiError(parsed.error, req);
      }

      const { type } = parsed.data;

    let result;

    switch (type) {
      case 'main':
        console.log('Running main seed script...');
        result = await execAsync('npx --yes tsx scripts/seed.ts', {
          env: process.env,
          timeout: 300000, // 5 minutes
        });
        break;

      case 'redis':
        console.log('Running Redis seed script...');
        result = await execAsync('npx --yes tsx scripts/seed-redis.ts', {
          env: process.env,
          timeout: 120000, // 2 minutes
        });
        break;

      case 'warm':
        console.log('Running cache warming...');
        result = await execAsync('npm run warm', {
          env: process.env,
          timeout: 120000,
        });
        break;

      case 'demo':
        console.log('Running demo data generator...');
        result = await execAsync('npx --yes tsx scripts/generate-demo.ts', {
          env: process.env,
          timeout: 300000,
        });
        break;

      case 'complete':
        console.log('Running complete seed (10 records per table)...');
        result = await execAsync('npx --yes tsx scripts/seed-complete-10.ts', {
          env: process.env,
          timeout: 300000,
        });
        break;

      case 'full':
      default:
        console.log('Running full seed process...');
        result = await execAsync(
          'npx --yes tsx scripts/seed.ts && npx --yes tsx scripts/seed-redis.ts',
          {
            env: process.env,
            timeout: 600000, // 10 minutes
          }
        );
        break;
    }

    return createSuccessResponse(
      {
        type,
        output: result.stdout,
        stderr: result.stderr,
      },
      undefined,
      `Seed operation '${type}' completed successfully`
    );
  } catch (error: any) {
    console.error('Seed error:', error);
    return handleApiError(error, req);
  }
  },
  { roles: ['ADMIN'] }
);

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { normalizeUser } from '@/domain/users/normalizeUser';
import { ConflictError, ValidationError, handleApiError, withAuth } from '@/lib/api-middleware';
import { createUser, getUserByEmail } from '@/lib/auth';
import { authRateLimit, withRateLimit } from '@/lib/rate-limit';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must include letters and numbers'),
  role: z.enum(['ADMIN', 'OPERATIONS']),
});

const registerHandler = withAuth(
  async (request: NextRequest) => {
    try {
      const payload = await request.json().catch(() => ({}));
      const parsed = registerSchema.safeParse(payload);

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new ValidationError(
          issue?.message ?? 'Invalid registration data',
          parsed.error.format(),
          issue?.path?.join('.')
        );
      }

      const { email, name, password, role } = parsed.data;

      const existing = await getUserByEmail(email);
      if (existing) {
        throw new ConflictError('User with this email already exists');
      }

      const user = await createUser({
        email,
        name,
        password,
        role,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            // Cast to satisfy normalizeUser's RawUser type - AuthenticatedUser is compatible at runtime
            user: normalizeUser(user as Parameters<typeof normalizeUser>[0]),
          },
          message: 'User registered successfully',
        },
        { status: 201 }
      );
    } catch (error) {
      return handleApiError(error, request);
    }
  },
  { roles: ['ADMIN'] }
);

export async function POST(request: NextRequest, ...args: any[]) {
  return withRateLimit(authRateLimit, registerHandler)(request, ...args);
}

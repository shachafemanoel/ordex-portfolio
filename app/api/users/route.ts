export const dynamic = 'force-dynamic';

import { isTenantRuntime, requireTenantContext } from '@/lib/tenancy/context';
import { normalizeUser } from '@/domain/users/normalizeUser';
import { hashPassword } from '@/lib/auth/hash';
import { withAuth } from '@/lib/api-middleware';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateUserRequest = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required'),
  role: z.nativeEnum(UserRole).default(UserRole.OPERATIONS),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const UsersQuerySchema = z.object({
  q: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

async function getUsers(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const parsed = UsersQuerySchema.safeParse(queryParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid query parameters', details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }

    const { q, role, limit = 50, cursor } = parsed.data;

    if (isTenantRuntime()) {
      const { tenantId } = await requireTenantContext();
      const memberships = await prisma.tenantMembership.findMany({
        where: { tenantId, isActive: true, user: { isActive: true, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}) }, ...(role ? { role: role === 'ADMIN' ? 'ADMIN' as const : 'OPERATIONS' as const } : {}) },
        take: Math.min(100, Math.max(1, limit)), orderBy: { createdAt: 'asc' },
        select: { role: true, user: { select: { id: true, email: true, name: true, phone: true, isActive: true, createdAt: true, _count: { select: { assignedOrders: true } } } } },
      });
      return NextResponse.json({ success: true, data: memberships.map((member) => normalizeUser({ ...member.user, role: member.role })), pagination: { total: memberships.length, nextCursor: null, limit: Math.min(100, Math.max(1, limit)) } });
    }

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user
        .findMany({
          where,
          take: limit + 1, // Take one extra to determine if there's a next page
          ...(cursor && {
            cursor: { id: cursor },
            skip: 1, // Skip the cursor item itself
          }),
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { assignedOrders: true },
            },
          },
        })
        .catch((error) => {
          console.error('Error fetching users:', error);
          return [];
        }),
      prisma.user.count({ where }).catch((error) => {
        console.error('Error counting users:', error);
        return 0;
      }),
    ]);

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, -1) : users;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    // Safely normalize users with error handling for legacy data
    const normalized = items.map((user) => {
      try {
        return normalizeUser(user as any);
      } catch (error) {
        console.error(`Error normalizing user ${user.id}:`, error);
        // Return a minimal valid user object
        return {
          id: user.id,
          email: user.email,
          name: user.name || 'Unknown User',
          role: user.role || 'OPERATIONS',
          isActive: user.isActive ?? true,
          phone: user.phone || null,
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          assignedOrdersCount: 0,
        };
      }
    });

    return NextResponse.json({
      success: true,
      data: normalized,
      pagination: {
        total,
        nextCursor: nextCursor ?? null,
        limit,
        filters: { q: q ?? null, role: role ?? null },
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    // Return empty but valid structure on error
    return NextResponse.json({
      success: false,
      data: [],
      pagination: {
        total: 0,
        nextCursor: null,
        limit: 50,
        filters: { q: null, role: null },
      },
    });
  }
}

async function createUser(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateUserRequest.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid input data', details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { message: 'User with this email already exists' } },
        { status: 409 }
      );
    }

    const { email, name, role, password } = parsed.data;

    let passwordHash: string;
    try {
      passwordHash = await hashPassword(password);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Invalid password provided',
          },
        },
        { status: 400 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        role,
        password: passwordHash,
      },
      include: {
        _count: {
          select: { assignedOrders: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: normalizeUser(newUser as any) }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create user' } },
      { status: 500 }
    );
  }
}

// Both GET and POST require ADMIN role
export const GET = withAuth(getUsers, { roles: ['ADMIN'] });
export const POST = withAuth(createUser, { roles: ['ADMIN'] });

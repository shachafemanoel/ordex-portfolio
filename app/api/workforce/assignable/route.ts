import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => {
  const workers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        in: [UserRole.INSTALLER, UserRole.OPERATIONS],
      },
    },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({
    success: true,
    data: workers,
  });
});

import { withIdentityDatabase } from '@/lib/db';
import { tenantRoute } from '@/lib/tenancy/api';
import { NextResponse } from 'next/server';

export const GET = tenantRoute(async (_req, user) =>
  NextResponse.json({
    success: true,
    data: {
      activeTenantId: user.tenantId,
      memberships: await withIdentityDatabase((db) =>
        db.tenantMembership.findMany({
          where: { userId: user.id, isActive: true, tenant: { isActive: true } },
          select: { tenantId: true, role: true, tenant: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        })
      ),
    },
  })
);

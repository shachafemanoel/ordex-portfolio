export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { upsertProfile, getUserWithProfile } from '@/lib/services/users/UserProfilesService';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

const InstallerSchema = z.object({
  currentAssignments: z.number().int().nonnegative().optional(),
  completedInstalls: z.number().int().nonnegative().optional(),
  regions: z.any().optional(),
  skills: z.any().optional(),
  avgSlaMinutes: z.number().int().nonnegative().optional().nullable(),
  vehicleType: z.string().optional().nullable(),
  calendarSync: z.boolean().optional(),
});

const SalesSchema = z.object({
  quotaMonthly: z.number().int().nonnegative().optional().nullable(),
  achievedMonth: z.number().int().nonnegative().optional().nullable(),
  pipelineCount: z.number().int().nonnegative().optional().nullable(),
  conversionRate: z.number().optional().nullable(),
  regions: z.any().optional(),
  commissionPlan: z.any().optional(),
});

const OpsSchema = z.object({
  inventoryScope: z.any().optional(),
  poApprovalLimit: z.number().int().nonnegative().optional().nullable(),
  slaBreachAlerts: z.boolean().optional(),
  teamsManaged: z.any().optional(),
  dashboards: z.any().optional(),
});

export const GET = withAuth(async (_req: NextRequest, _user, { params }: { params: { id: string } }) => {
  const user = await getUserWithProfile(params.id);
  if (!user) {
    return NextResponse.json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: user });
});

export const PATCH = withAuth(async (req: NextRequest, user, { params }: { params: { id: string } }) => {
  const targetUserId = params.id;
  const body = await req.json();

  // Only ADMIN/OPS can update others; self can update limited fields (validated by schema and role)
  if (user.id !== targetUserId && !['ADMIN', 'OPERATIONS'].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 });
  }

  // Need the role to choose schema
  const target = await getUserWithProfile(targetUserId);
  if (!target) {
    return NextResponse.json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }

  let parsed: any;
  switch (target.role) {
    case UserRole.ADMIN:
    case UserRole.OPERATIONS:
    case UserRole.SALES:
    case UserRole.PURCHASING:
    case UserRole.INSTALLER:
    case UserRole.VIEWER:
      parsed = OpsSchema.parse(body);
      break;
    default:
      return NextResponse.json({ success: false, error: { message: 'Role has no profile' } }, { status: 400 });
  }

  const updated = await upsertProfile(targetUserId, target.role, parsed);
  return NextResponse.json({ success: true, data: updated });
});

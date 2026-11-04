import { normalizeStatus } from '@/domain/status/legacyStatusMap';
import { requireAuthWithRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/orders/:id/status
 * Handles legacy status update payloads.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthWithRole(request);
  const body = await request.json();
  const normalized = normalizeStatus(body.status);

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status: normalized as any },
  });

  return NextResponse.json({ success: true, status: updated.status });
}

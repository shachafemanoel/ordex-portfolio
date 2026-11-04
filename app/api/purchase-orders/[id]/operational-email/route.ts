import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  GoogleIntegrationInvalidError,
  GoogleIntegrationMissingError,
} from '@/lib/integrations/google/errors';
import { prisma } from '@/lib/db';
import { OperationalEmailService } from '@/lib/services/operational/OperationalEmailService';
import { OperationalMessageKind } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  templateId: z.string().uuid().optional(),
  operationalKind: z.nativeEnum(OperationalMessageKind).optional(),
  to: z.string().email().optional(),
  subject: z.string().max(998).optional(),
  body: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
  messageKind: z.nativeEnum(OperationalMessageKind).optional(),
});

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse('Validation failed', 400, parsed.error.flatten());
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: { supplier: true },
    });
    if (!po) {
      return createErrorResponse('Purchase order not found', 404);
    }

    const to =
      parsed.data.to?.trim() ||
      po.supplier.email?.trim() ||
      (() => {
        return null as string | null;
      })();
    if (!to) {
      return createErrorResponse('Supplier has no email; pass `to` explicitly', 400);
    }

    if (!parsed.data.templateId && !parsed.data.operationalKind && !parsed.data.body) {
      return createErrorResponse(
        'Provide templateId, operationalKind, or body for the message',
        400
      );
    }

    const idempotencyKey =
      parsed.data.idempotencyKey ?? req.headers.get('idempotency-key') ?? undefined;

    try {
      const svc = new OperationalEmailService();
      const result = await svc.send({
        actorUserId: user.id,
        purchaseOrderId: params.id,
        supplierId: po.supplierId,
        templateId: parsed.data.templateId ?? null,
        operationalKind: parsed.data.operationalKind ?? null,
        to,
        subjectOverride: parsed.data.subject ?? null,
        bodyOverride: parsed.data.body ?? null,
        idempotencyKey: idempotencyKey ?? null,
        messageKind: parsed.data.messageKind ?? OperationalMessageKind.PURCHASE_REQUEST_SUPPLIER,
      });
      return createSuccessResponse({
        messageLogId: result.messageLogId,
        deduped: result.deduped ?? false,
        externalId: result.externalId ?? null,
      });
    } catch (e) {
      if (e instanceof GoogleIntegrationMissingError) {
        return createErrorResponse(e.message, 503, { code: e.code });
      }
      if (e instanceof GoogleIntegrationInvalidError) {
        return createErrorResponse(e.message, 409, { code: e.code });
      }
      console.error('[po operational-email]', e);
      return createErrorResponse(e instanceof Error ? e.message : 'Send failed', 500);
    }
  },
  { permissions: ['SEND_OPERATIONAL_EMAIL'] }
);

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  GoogleIntegrationInvalidError,
  GoogleIntegrationMissingError,
} from '@/lib/integrations/google/errors';
import { OperationalEmailService } from '@/lib/services/operational/OperationalEmailService';
import { OperationalMessageKind } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  templateId: z.string().uuid().optional(),
  operationalKind: z.nativeEnum(OperationalMessageKind).optional(),
  supplierId: z.string().uuid().optional(),
  to: z.string().email().min(3),
  subject: z.string().max(998).optional(),
  body: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
  messageKind: z.nativeEnum(OperationalMessageKind).optional(),
  fullOrderItemsForSupplierTemplate: z.boolean().optional(),
  supplierDisplayName: z.string().min(1).max(200).optional(),
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

    const idempotencyKey =
      parsed.data.idempotencyKey ?? req.headers.get('idempotency-key') ?? undefined;

    if (!parsed.data.templateId && !parsed.data.operationalKind && !parsed.data.body) {
      return createErrorResponse(
        'Provide templateId, operationalKind, or body for the message',
        400
      );
    }

    try {
      const svc = new OperationalEmailService();
      const result = await svc.send({
        actorUserId: user.id,
        orderId: params.id,
        templateId: parsed.data.templateId ?? null,
        operationalKind: parsed.data.operationalKind ?? null,
        supplierId: parsed.data.supplierId ?? null,
        to: parsed.data.to,
        subjectOverride: parsed.data.subject ?? null,
        bodyOverride: parsed.data.body ?? null,
        idempotencyKey: idempotencyKey ?? null,
        messageKind: parsed.data.messageKind ?? null,
        fullOrderItemsForSupplierTemplate: parsed.data.fullOrderItemsForSupplierTemplate ?? false,
        supplierDisplayName: parsed.data.supplierDisplayName?.trim() ?? null,
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
      console.error('[operational-email]', e);
      return createErrorResponse(e instanceof Error ? e.message : 'Send failed', 500);
    }
  },
  { permissions: ['SEND_OPERATIONAL_EMAIL'] }
);

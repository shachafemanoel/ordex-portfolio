import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { OperationalWhatsAppService } from '@/lib/services/operational/OperationalWhatsAppService';
import { OperationalMessageKind } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  templateId: z.string().uuid().optional(),
  operationalKind: z.nativeEnum(OperationalMessageKind).optional(),
  mode: z.enum(['db_text', 'meta_template']).optional(),
  metaTemplateName: z.string().min(1).max(128).optional(),
  metaBodyParams: z.array(z.string().max(1024)).max(20).optional(),
  etaMinutes: z.number().finite().optional().nullable(),
  estimatedArrivalAt: z.string().max(64).optional().nullable(),
  courierName: z.string().max(120).optional().nullable(),
  idempotencyKey: z.string().min(8).max(128).optional(),
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

    const mode = parsed.data.mode ?? 'db_text';
    if (mode === 'meta_template' && !parsed.data.metaTemplateName?.trim()) {
      return createErrorResponse('metaTemplateName is required when mode is meta_template', 400);
    }

    try {
      const svc = new OperationalWhatsAppService();
      const result = await svc.send({
        actorUserId: user.id,
        orderId: params.id,
        templateId: parsed.data.templateId ?? null,
        operationalKind: parsed.data.operationalKind ?? null,
        mode,
        metaTemplateName: parsed.data.metaTemplateName?.trim() ?? null,
        metaBodyParams: parsed.data.metaBodyParams,
        etaMinutes: parsed.data.etaMinutes ?? null,
        estimatedArrivalAt: parsed.data.estimatedArrivalAt ?? null,
        courierName: parsed.data.courierName?.trim() ?? null,
        idempotencyKey: idempotencyKey ?? null,
      });
      return createSuccessResponse({
        messageLogId: result.messageLogId,
        externalId: result.externalId ?? null,
      });
    } catch (e) {
      console.error('[operational-whatsapp]', e);
      return createErrorResponse(e instanceof Error ? e.message : 'Send failed', 500);
    }
  },
  { permissions: ['SEND_OPERATIONAL_EMAIL'] }
);

import { prisma } from '@/lib/db';
import {
  TemplateRenderingService,
  type TemplateRenderContext,
} from './TemplateRenderingService';
import { sendMetaTemplateOrderedParams, sendWhatsApp } from '@/lib/whatsapp';
import { MessageStatus, NotificationChannel, OperationalMessageKind } from '@prisma/client';

export type SendOperationalWhatsAppInput = {
  actorUserId: string;
  orderId: string;
  operationalKind?: OperationalMessageKind | null;
  templateId?: string | null;
  /** db_text = תוכן מ-MessageTemplate (ערוץ WHATSAPP); meta_template = תבנית מאושרת ב-Meta */
  mode?: 'db_text' | 'meta_template';
  metaTemplateName?: string | null;
  metaBodyParams?: string[];
  etaMinutes?: number | null;
  estimatedArrivalAt?: string | null;
  courierName?: string | null;
  idempotencyKey?: string | null;
};

function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

function formatEtaSummaryHebrew(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) {
    return 'מועד הגעה משוער יתעדכן בקרוב';
  }
  const m = Math.round(minutes);
  if (m < 60) return `בערך ${m} דק׳`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `בערך ${h} ש׳ ו-${rest} דק׳` : `בערך ${h} ש׳`;
}

function formatArrivalClock(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export class OperationalWhatsAppService {
  private readonly templates = new TemplateRenderingService();

  private async buildContextFromOrder(orderId: string): Promise<TemplateRenderContext> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
        shippingAddress: true,
      },
    });
    if (!order) {
      throw new Error('Order not found');
    }

    const lineItems = order.items;
    const itemsList = lineItems
      .map((i) => `- ${i.sku}: ${i.qty}${i.name ? ` (${i.name})` : ''}`)
      .join('\n');

    const addr = order.shippingAddress;
    const addressLine = addr
      ? `${addr.street} ${addr.number}, ${addr.city}`
      : order.addressLine || '';

    const installationDate = order.scheduledAt
      ? new Date(order.scheduledAt).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })
      : '';
    const installationTime = order.scheduledAt
      ? new Date(order.scheduledAt).toLocaleTimeString('he-IL', {
          timeZone: 'Asia/Jerusalem',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    const twA = order.timeWindowStart?.trim();
    const twB = order.timeWindowEnd?.trim();
    const timeWindow = twA && twB ? `${twA}–${twB}` : twA || twB || '';

    const deliveryScheduleSummary = [installationDate, installationTime, timeWindow, addressLine]
      .filter(Boolean)
      .join(' · ');

    return {
      orderNumber: order.orderNumber || order.number,
      customerName: order.customer?.name || order.customerName || '',
      city: order.city || addr?.city || '',
      address: addressLine,
      addressLine,
      notes: order.notes || order.notesInternal || '',
      notesToCrew: order.notesToCrew || '',
      items: itemsList,
      installationDate,
      installationTime,
      timeWindow,
      deliveryScheduleSummary,
    };
  }

  async send(input: SendOperationalWhatsAppInput): Promise<{
    messageLogId: string;
    externalId?: string | null;
  }> {
    if (input.idempotencyKey) {
      const existing = await prisma.messageLog.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing && existing.status === MessageStatus.SENT) {
        return { messageLogId: existing.id, externalId: existing.externalId };
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { customer: true },
    });
    if (!order) {
      throw new Error('Order not found');
    }

    const rawPhone = order.customer?.phone?.trim() || order.customerPhone?.trim() || '';
    const to = normalizePhoneForWhatsApp(rawPhone);
    if (!to) {
      throw new Error('No customer phone on order');
    }

    const mode = input.mode ?? 'db_text';
    const kind =
      input.operationalKind ?? OperationalMessageKind.DELIVERY_COURIER_ETA;

    let template: {
      id: string;
      content: string;
      operationalKind: OperationalMessageKind | null;
    } | null = null;

    if (input.templateId) {
      const t = await prisma.messageTemplate.findUnique({ where: { id: input.templateId } });
      if (!t || t.channel !== NotificationChannel.WHATSAPP) {
        throw new Error('Template not found or not a WhatsApp template');
      }
      template = { id: t.id, content: t.content, operationalKind: t.operationalKind };
    } else if (mode === 'db_text') {
      const t = await prisma.messageTemplate.findFirst({
        where: {
          operationalKind: kind,
          channel: NotificationChannel.WHATSAPP,
          isActive: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (t) {
        template = { id: t.id, content: t.content, operationalKind: t.operationalKind };
      }
    }

    const ctx = await this.buildContextFromOrder(input.orderId);
    const etaSummary = formatEtaSummaryHebrew(input.etaMinutes ?? undefined);
    const estimatedArrival = formatArrivalClock(input.estimatedArrivalAt ?? undefined);
    Object.assign(ctx, {
      etaMinutes:
        input.etaMinutes != null && Number.isFinite(input.etaMinutes)
          ? String(Math.round(input.etaMinutes))
          : '',
      etaSummary,
      estimatedArrival,
      courierName: input.courierName?.trim() || '',
    });

    let bodyText = '';
    let externalId: string | null = null;

    if (mode === 'meta_template') {
      const name = input.metaTemplateName?.trim();
      if (!name) {
        throw new Error('metaTemplateName is required for meta_template mode');
      }
      const params = input.metaBodyParams ?? [];
      const result = await sendMetaTemplateOrderedParams(to, name, params);
      if (!result.success) {
        throw new Error(result.error || 'WhatsApp Meta template send failed');
      }
      externalId = result.id ?? null;
      bodyText = `[Meta template: ${name}] ${params.join(' | ')}`;
    } else {
      if (!template?.content?.trim()) {
        throw new Error(
          'No active WhatsApp template for this operational kind — add one in Admin → Templates (channel WhatsApp)'
        );
      }
      bodyText = this.templates.renderBody(template.content, ctx).text;
      const sendResult = await sendWhatsApp(to, bodyText);
      if (!sendResult.success) {
        throw new Error(sendResult.error || 'WhatsApp send failed');
      }
      externalId = sendResult.id ?? null;
    }

    const messageKind = template?.operationalKind ?? kind;

    const log = await prisma.messageLog.create({
      data: {
        channel: NotificationChannel.WHATSAPP,
        to,
        subject: null,
        body: bodyText.slice(0, 8000),
        status: MessageStatus.SENT,
        provider: mode === 'meta_template' ? 'whatsapp_meta_template' : 'whatsapp_cloud',
        externalId,
        sentAt: new Date(),
        createdByUser: { connect: { id: input.actorUserId } },
        messageKind,
        order: { connect: { id: input.orderId } },
        ...(template ? { template: { connect: { id: template.id } } } : {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      },
    });

    return { messageLogId: log.id, externalId };
  }
}

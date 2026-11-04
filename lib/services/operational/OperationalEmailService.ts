import {
  GoogleIntegrationMissingError,
  GoogleIntegrationInvalidError,
} from '@/lib/integrations/google/errors';
import { prisma } from '@/lib/db';
import { GmailSendService } from '@/lib/services/google-workspace/GmailSendService';
import { GoogleOAuthCredentialsService } from '@/lib/services/google-workspace/GoogleOAuthCredentialsService';
import { DEFAULT_WORKSPACE_STORE_ID } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import {
  TemplateRenderingService,
  type TemplateRenderContext,
} from '@/lib/services/operational/TemplateRenderingService';
import { MessageStatus, NotificationChannel, OperationalMessageKind } from '@prisma/client';

export type SendOperationalEmailInput = {
  storeId?: string;
  actorUserId: string;
  orderId?: string | null;
  purchaseOrderId?: string | null;
  supplierId?: string | null;
  templateId?: string | null;
  operationalKind?: OperationalMessageKind | null;
  to: string;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
  idempotencyKey?: string | null;
  messageKind?: OperationalMessageKind | null;
  /** כל פריטי ההזמנה בתבנית לספק (ללא סינון לפי supplierId) */
  fullOrderItemsForSupplierTemplate?: boolean;
  /** דורס את שם הספק בהקשר התבנית (למשל ספק ידני) */
  supplierDisplayName?: string | null;
};

export class OperationalEmailService {
  private readonly gmail = new GmailSendService();
  private readonly oauth = new GoogleOAuthCredentialsService();
  private readonly templates = new TemplateRenderingService();

  private async buildContextFromOrder(
    orderId: string,
    options?: { restrictToSupplierId?: string | null }
  ): Promise<TemplateRenderContext> {
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

    let lineItems = order.items;
    if (options?.restrictToSupplierId) {
      lineItems = lineItems.filter((i) => i.supplierId === options.restrictToSupplierId);
      if (!lineItems.length) {
        throw new Error('No order lines linked to this supplier');
      }
    }

    const itemsList = lineItems
      .map((i) => `- ${i.sku}: ${i.qty}${i.name ? ` (${i.name})` : ''}`)
      .join('\n');

    const addr = order.shippingAddress;
    const addressLine = addr
      ? `${addr.street} ${addr.number}, ${addr.city}`
      : order.addressLine || '';

    const installAt = order.scheduledAt
      ? new Date(order.scheduledAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
      : '';

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
    const timeWindow =
      twA && twB ? `${twA}–${twB}` : twA || twB || '';

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
      installAt,
      timeWindow,
      deliveryScheduleSummary,
    };
  }

  private async buildContextFromPurchaseOrder(poId: string): Promise<TemplateRenderContext> {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true, items: { include: { product: true } } },
    });
    if (!po) throw new Error('Purchase order not found');

    const lines = po.items
      .map((i) => `- ${i.product.sku}: ${i.qtyOrdered}`)
      .join('\n');

    return {
      supplierName: po.supplier.name,
      supplierEmail: po.supplier.email || '',
      items: lines,
      orderNumber: po.reference,
    };
  }

  async send(input: SendOperationalEmailInput): Promise<{
    messageLogId: string;
    deduped?: boolean;
    externalId?: string | null;
  }> {
    const storeId = input.storeId ?? DEFAULT_WORKSPACE_STORE_ID;

    if (input.idempotencyKey) {
      const existing = await prisma.messageLog.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing && existing.status === MessageStatus.SENT) {
        return { messageLogId: existing.id, deduped: true, externalId: existing.externalId };
      }
    }

    const { connectedEmail } = await this.oauth.getValidAccessToken(storeId);

    let template: {
      id: string;
      subject: string | null;
      content: string;
      operationalKind: OperationalMessageKind | null;
    } | null = null;

    if (input.templateId) {
      const t = await prisma.messageTemplate.findUnique({ where: { id: input.templateId } });
      if (!t || t.channel !== NotificationChannel.EMAIL) {
        throw new Error('Template not found or not an email template');
      }
      template = {
        id: t.id,
        subject: t.subject,
        content: t.content,
        operationalKind: t.operationalKind,
      };
    } else if (input.operationalKind) {
      const t = await prisma.messageTemplate.findFirst({
        where: {
          operationalKind: input.operationalKind,
          channel: NotificationChannel.EMAIL,
          isActive: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (t) {
        template = {
          id: t.id,
          subject: t.subject,
          content: t.content,
          operationalKind: t.operationalKind,
        };
      }
    }

    const ctx: TemplateRenderContext = {};
    if (input.orderId) {
      const restrictSupplier =
        input.operationalKind === OperationalMessageKind.ORDER_ITEMS_SUPPLIER &&
        input.supplierId &&
        !input.fullOrderItemsForSupplierTemplate
          ? input.supplierId
          : undefined;
      Object.assign(
        ctx,
        await this.buildContextFromOrder(input.orderId, {
          restrictToSupplierId: restrictSupplier,
        })
      );
    }
    if (input.purchaseOrderId) {
      Object.assign(ctx, await this.buildContextFromPurchaseOrder(input.purchaseOrderId));
    }
    if (input.supplierId) {
      const s = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
      if (s) {
        ctx.supplierName = s.name;
        ctx.supplierEmail = s.email || '';
      }
    }
    if (input.supplierDisplayName?.trim()) {
      ctx.supplierName = input.supplierDisplayName.trim();
    }
    if (
      input.operationalKind === OperationalMessageKind.ORDER_ITEMS_SUPPLIER &&
      input.fullOrderItemsForSupplierTemplate &&
      input.to?.trim()
    ) {
      ctx.supplierEmail = input.to.trim();
    }

    const bodySource = input.bodyOverride?.trim() || template?.content;
    if (!bodySource) {
      throw new Error('No email body: provide template or bodyOverride');
    }

    const { text, html } = this.templates.renderBody(bodySource, ctx);
    const subject = input.subjectOverride?.trim()
      ? this.templates.renderSubject(input.subjectOverride, ctx)
      : this.templates.renderSubject(template?.subject ?? null, ctx);

    const messageKind =
      input.messageKind ?? template?.operationalKind ?? OperationalMessageKind.CUSTOM;

    const log = await prisma.messageLog.create({
      data: {
        channel: NotificationChannel.EMAIL,
        to: input.to,
        subject,
        body: text,
        status: MessageStatus.PENDING,
        createdByUser: { connect: { id: input.actorUserId } },
        messageKind,
        ...(input.orderId ? { order: { connect: { id: input.orderId } } } : {}),
        ...(template ? { template: { connect: { id: template.id } } } : {}),
        ...(input.purchaseOrderId
          ? { purchaseOrder: { connect: { id: input.purchaseOrderId } } }
          : {}),
        ...(input.supplierId ? { supplier: { connect: { id: input.supplierId } } } : {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      },
    });

    try {
      const { messageId } = await this.gmail.send({
        storeId,
        fromMailbox: connectedEmail,
        to: input.to,
        subject,
        textPlain: text,
        textHtml: html,
      });

      await prisma.messageLog.update({
        where: { id: log.id },
        data: {
          status: MessageStatus.SENT,
          provider: 'gmail',
          externalId: messageId,
          sentAt: new Date(),
          error: null,
        },
      });

      return { messageLogId: log.id, externalId: messageId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.messageLog.update({
        where: { id: log.id },
        data: {
          status: MessageStatus.FAILED,
          error: msg.slice(0, 4000),
        },
      });
      throw e;
    }
  }
}

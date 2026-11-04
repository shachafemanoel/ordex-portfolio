import { createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { whatsapp } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  channel: z.enum(['whatsapp', 'sms']).default('whatsapp'),
});

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const { channel } = bodySchema.parse(await req.json().catch(() => ({})));
    const orderId = params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order) {
      return NextResponse.json(
        { success: false, error: { message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Best-effort WhatsApp reminder
    if (channel === 'whatsapp' && order.customerPhone) {
      try {
        await whatsapp.sendTemplateMessage(order.customerPhone, 'order_reminder', {
          name: order.customerName || 'לקוח/ה',
          number: order.number,
          date: order.scheduledAt?.toISOString() || '',
        });
      } catch (err) {
        console.warn('WhatsApp reminder failed', err);
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    });

    return createSuccessResponse({ orderId }, undefined, 'תזכורת נשלחה (לפי זמינות)');
  },
  { permissions: ['EDIT_ORDERS'] }
);

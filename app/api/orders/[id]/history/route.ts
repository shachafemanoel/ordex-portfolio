import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { OrderStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface HistoryEntry {
  timestamp: string;
  status: OrderStatus;
  note?: string;
  userId?: string;
  userName?: string;
}

/**
 * GET /api/orders/[id]/history
 * Fetch status history for an order from Redis Stream
 */
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await props.params;
  try {
    const orderId = params.id;
    let history: HistoryEntry[] = [];

    // Prefer Prisma status history when available
    const dbHistory = await prisma.statusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { changedByUser: true },
    });

    if (dbHistory.length > 0) {
      history = dbHistory.map((h) => ({
        timestamp: h.createdAt.toISOString(),
        status: h.toStatus as OrderStatus,
        note: h.reason ?? undefined,
        userId: h.changedBy ?? undefined,
        userName: h.changedByUser?.name ?? undefined,
      }));
    }

    // Try Redis Stream first
    if (history.length === 0 && redis) {
      try {
        const streamKey = `ordex:order:${orderId}:history`;
        const entries = await redis.xRange(streamKey, '-', '+');

        for (const entry of entries) {
          // entryId available but not used in this implementation
          // const entryId = entry.id;
          const fields = entry.message;
          const fieldsObj: Record<string, string> = {};

          // Convert fields object to Record<string, string>
          for (const [key, value] of Object.entries(fields)) {
            fieldsObj[key] = String(value);
          }

          history.push({
            timestamp: new Date(parseInt(fieldsObj.timestamp || '0')).toISOString(),
            status: fieldsObj.status as OrderStatus,
            note: fieldsObj.note || undefined,
            userId: fieldsObj.userId || undefined,
            userName: fieldsObj.userName || undefined,
          });
        }
      } catch (redisError) {
        console.warn('Redis history fetch failed:', redisError);
      }
    }

    // Fallback: get order from DB and create a single entry with current status
    if (history.length === 0) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          status: true,
          updatedAt: true,
          createdAt: true,
        },
      });

      if (order) {
        history.push({
          timestamp: order.updatedAt.toISOString(),
          status: order.status as OrderStatus,
          note: 'סטטוס נוכחי (אין היסטוריה זמינה)',
        });
      }
    }

    // Sort by timestamp descending (newest first)
    history.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching order history:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Failed to fetch order history' },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders/[id]/history
 * Add a new status change to the history
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await props.params;
  try {
    const orderId = params.id;
    const { status, note, userId, userName } = await req.json();

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Status is required' },
        },
        { status: 400 }
      );
    }

    const timestamp = Date.now();

    // Save to Redis Stream
    if (redis) {
      try {
        const streamKey = `ordex:order:${orderId}:history`;
        await redis.xAdd(streamKey, '*', {
          status,
          note: note || '',
          userId: userId || '',
          userName: userName || '',
          timestamp: String(timestamp),
        });
      } catch (redisError) {
        console.warn('Redis history save failed:', redisError);
      }
    }

    // Update order status in DB
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: status as OrderStatus,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      entry: {
        timestamp: new Date(timestamp).toISOString(),
        status,
        note,
        userId,
        userName,
      },
    });
  } catch (error) {
    console.error('Error saving order history:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Failed to save order history' },
      },
      { status: 500 }
    );
  }
}

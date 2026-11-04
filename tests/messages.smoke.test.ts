import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { NotificationChannel, MessageStatus } from '@prisma/client';

const describeIfDb = globalThis.hasTestDatabase ? describe : describe.skip;

describeIfDb('MessageLog smoke', () => {
  it('creates a pending message log entry', async () => {
    const log = await prisma.messageLog.create({
      data: {
        channel: NotificationChannel.WHATSAPP,
        to: '0500000000',
        body: 'בדיקת הודעה',
        status: MessageStatus.PENDING,
      },
    });

    expect(log.status).toBe(MessageStatus.PENDING);

    await prisma.messageLog.delete({ where: { id: log.id } });
  });
});

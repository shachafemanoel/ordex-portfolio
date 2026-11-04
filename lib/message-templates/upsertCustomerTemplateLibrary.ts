import { databaseTenantId } from '@/lib/tenancy/context';
import type { PrismaClient } from '@prisma/client';
import { NotificationChannel } from '@prisma/client';

import { CUSTOMER_MESSAGE_TEMPLATE_PRESETS } from './customer-template-library';

/**
 * יוצר/מעדכן רשומות MessageTemplate מהספרייה (שם ייחודי לכל תבנית).
 */
export async function upsertCustomerMessageTemplateLibrary(
  prisma: PrismaClient
): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const preset of CUSTOMER_MESSAGE_TEMPLATE_PRESETS) {
    const subject =
      preset.channel === NotificationChannel.EMAIL
        ? (preset.subject?.trim() ?? '(ללא נושא)')
        : null;

    await prisma.messageTemplate.upsert({
      where: { tenantId_name: { tenantId: await databaseTenantId(), name: preset.name } },
      create: {
        name: preset.name,
        channel: preset.channel,
        target: preset.target,
        content: preset.content,
        variables: preset.variables,
        operationalKind: preset.operationalKind,
        isActive: true,
        demo: true,
        subject,
      },
      update: {
        channel: preset.channel,
        target: preset.target,
        content: preset.content,
        variables: preset.variables,
        operationalKind: preset.operationalKind,
        isActive: true,
        demo: true,
        subject,
      },
    });
    upserted += 1;
  }

  return { upserted };
}

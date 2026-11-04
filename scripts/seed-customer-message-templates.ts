#!/usr/bin/env tsx
/**
 * דוחף ל-DB את תבניות ההודעה מהספרייה (ללא seed מלא).
 * שימוש: npm run seed:customer-templates
 */
import 'dotenv/config';

import { getBasePrismaClient } from '@/lib/db';
import { upsertCustomerMessageTemplateLibrary } from '@/lib/message-templates/upsertCustomerTemplateLibrary';

const prisma = getBasePrismaClient();

async function main(): Promise<void> {
  const { upserted } = await upsertCustomerMessageTemplateLibrary(prisma);
  console.log(`✅ upsert של ${upserted} תבניות ללקוח (message_templates)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

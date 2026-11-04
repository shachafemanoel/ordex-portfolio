/**
 * Verify Data Compatibility
 *
 * Runs at startup to verify the database is accessible and
 * the schema is compatible with the current application version.
 * Exits with code 1 if critical checks fail.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Verifying data compatibility ---');

  // 1. Check DB connectivity
  await prisma.$queryRaw`SELECT 1`;
  console.log('  [OK] Database connection');

  // 2. Check core tables are accessible
  const [userCount, orderCount] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
  ]);
  console.log(`  [OK] Users: ${userCount}, Orders: ${orderCount}`);

  // 3. Verify at least one admin user exists
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount === 0) {
    console.warn('  [WARN] No admin users found');
  } else {
    console.log(`  [OK] Admin users: ${adminCount}`);
  }

  console.log('--- Data compatibility verified ---');
}

main()
  .catch((e) => {
    console.error('Data compatibility check failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

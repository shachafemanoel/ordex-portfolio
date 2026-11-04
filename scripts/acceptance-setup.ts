import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { hashPassword } from '../lib/auth/hash';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../lib/db';
import { withTenantContext } from '../lib/tenancy/context';

// Seeds one business for the MVP acceptance tests: an admin, an operations employee, a customer
// with a full address and a product. Disposable local retzef_*test databases only.
// Usage: node --import tsx scripts/acceptance-setup.ts <private output path>
async function main() {
  const output = process.argv[2];
  assert(output, 'An output path is required');
  const url = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(url.hostname), 'Only a disposable local database is permitted');
  assert(/^retzef_.*test/.test(url.pathname.slice(1)), 'A retzef_*test database is required');
  assert.equal(process.env.TENANT_ENFORCEMENT, 'true');

  const tenantId = randomUUID();
  const run = (suffix: string) => `${suffix}-${tenantId.slice(0, 8)}@example.invalid`;
  const accounts = {
    admin: { id: randomUUID(), email: run('admin'), name: 'מנהלת העסק', role: 'ADMIN' as const },
    staff: { id: randomUUID(), email: run('staff'), name: 'עובד תפעול', role: 'OPERATIONS' as const },
  };
  const password = randomBytes(12).toString('hex');
  const passwordHash = await hashPassword(password);

  await writeFile(output, '', { flag: 'wx', mode: 0o600 });
  await withIdentityDatabase(async (db) => {
    await db.tenant.create({ data: { id: tenantId, name: 'עסק לבדיקות קבלה' } });
    for (const account of Object.values(accounts)) {
      await db.user.create({
        data: { id: account.id, email: account.email, name: account.name, password: passwordHash, role: account.role },
      });
      await db.tenantMembership.create({ data: { tenantId, userId: account.id, role: account.role } });
    }
    await db.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    await db.storeConfiguration.create({
      data: { id: tenantId.replaceAll('-', ''), tenantId, storeName: 'עסק לבדיקות קבלה', autoPurchaseOrder: false, taxRatePercent: 0 },
    });
  });

  const seed = await withTenantContext({ tenantId, userId: accounts.admin.id, role: 'ADMIN' }, async () => {
    const customer = await prisma.customer.create({ data: { name: 'דנה כהן', phone: '0521234567' } });
    for (const type of ['BILLING', 'SHIPPING'] as const) {
      await prisma.address.create({
        data: { customerId: customer.id, type, city: 'חיפה', street: 'הרצל', number: '5' },
      });
    }
    const product = await prisma.product.create({
      data: { name: 'ספת שלושה מושבים', sku: `SOFA-${tenantId.slice(0, 6)}`, basePriceCents: 450000, stock: 5 },
    });
    return { customerId: customer.id, customerName: customer.name, productId: product.id, productName: product.name };
  });

  const secondaryTenantId = randomUUID();
  const secondary = {
    tenantId: secondaryTenantId,
    admin: { id: randomUUID(), email: `second-admin-${secondaryTenantId}@example.invalid` },
    staff: { id: randomUUID(), email: `second-staff-${secondaryTenantId}@example.invalid` },
  };
  await withIdentityDatabase(async (db) => {
    await db.tenant.create({ data: { id: secondaryTenantId, name: 'עסק שני לבדיקות קבלה' } });
    for (const [kind, account] of Object.entries({ admin: secondary.admin, staff: secondary.staff })) {
      const role = kind === 'admin' ? 'ADMIN' : 'OPERATIONS';
      await db.user.create({ data: { ...account, name: kind === 'admin' ? 'מנהל עסק שני' : 'עובד עסק שני', password: passwordHash, role } });
      await db.tenantMembership.create({ data: { tenantId: secondaryTenantId, userId: account.id, role } });
    }
    await db.$queryRaw`SELECT set_config('app.tenant_id', ${secondaryTenantId}, true)`;
    await db.storeConfiguration.create({ data: { id: secondaryTenantId.replaceAll('-', ''), tenantId: secondaryTenantId, storeName: 'עסק שני לבדיקות קבלה', autoPurchaseOrder: false, taxRatePercent: 0 } });
  });

  await writeFile(
    output,
    JSON.stringify({
      tenantId,
      password,
      secondary,
      admin: { id: accounts.admin.id, email: accounts.admin.email },
      staff: { id: accounts.staff.id, email: accounts.staff.email },
      ...seed,
    })
  );
  console.log('Acceptance business created. Credentials saved to the private output file.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Acceptance setup failed');
    process.exitCode = 1;
  })
  .finally(() => closeDatabaseConnection());

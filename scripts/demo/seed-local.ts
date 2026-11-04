import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../../lib/auth/hash';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../../lib/db';
import { getOrdersService } from '../../lib/services/ServiceFactory';
import { withTenantContext } from '../../lib/tenancy/context';

// Seeds the local pilot demo: two fictional businesses, each with an admin and an operations
// employee, customers, products and a few new orders. Everything is synthetic.
// Run by scripts/demo/local.sh setup, against the dedicated retzef_demo database only.
// Usage: DEMO_PASSWORD=<shared demo password> node --import tsx scripts/demo/seed-local.ts

const BUSINESSES = [
  {
    key: 'main',
    name: 'רהיטי הדגמה',
    customers: [
      { name: 'דנה כהן', phone: '0500000001', city: 'חיפה', street: 'הרצל', number: '5' },
      { name: 'יוסי לוי', phone: '0500000002', city: 'תל אביב', street: 'דיזנגוף', number: '120' },
      { name: 'מיכל אברהם', phone: '0500000003', city: 'ירושלים', street: 'יפו', number: '44' },
    ],
    products: [
      { name: 'ספה תלת מושבית', sku: 'SOFA-3', priceCents: 450000, stock: 4 },
      { name: 'שולחן אוכל אלון', sku: 'TABLE-OAK', priceCents: 320000, stock: 2 },
      { name: 'כורסת טלוויזיה', sku: 'RECLINER', priceCents: 210000, stock: 6 },
      { name: 'ארון שלוש דלתות', sku: 'WARDROBE-3', priceCents: 380000, stock: 1 },
      { name: 'מיטה זוגית', sku: 'BED-DOUBLE', priceCents: 290000, stock: 3 },
    ],
    // [customer index, product indexes]
    orders: [
      [0, [0]],
      [1, [1, 2]],
      [2, [4]],
    ] as const,
  },
  {
    key: 'second',
    name: 'מטבחי הדגמה',
    customers: [{ name: 'אורי שמש', phone: '0500000004', city: 'באר שבע', street: 'רגר', number: '10' }],
    // Same SKU as the first business on purpose: businesses never share records.
    products: [{ name: 'שולחן אוכל אלון', sku: 'TABLE-OAK', priceCents: 300000, stock: 5 }],
    orders: [[0, [0]]] as const,
  },
];

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Only the local demo database is permitted');
  assert.equal(url.pathname.slice(1), 'retzef_demo', 'The retzef_demo database is required');
  assert.equal(process.env.TENANT_ENFORCEMENT, 'true');
  assert.equal(process.env.RETZEF_DEMO_ENVIRONMENT, 'true');
  const password = process.env.DEMO_PASSWORD || '';
  assert(password.length >= 12, 'DEMO_PASSWORD is required');
  const passwordHash = await hashPassword(password);

  for (const business of BUSINESSES) {
    const tenantId = randomUUID();
    const accounts = [
      { id: randomUUID(), email: `admin.${business.key}@retzef-demo.invalid`, name: 'מנהלת העסק', role: 'ADMIN' as const },
      { id: randomUUID(), email: `staff.${business.key}@retzef-demo.invalid`, name: 'עובד תפעול', role: 'OPERATIONS' as const },
    ];

    await withIdentityDatabase(async (db) => {
      await db.tenant.create({ data: { id: tenantId, name: business.name } });
      for (const account of accounts) {
        await db.user.create({
          data: { id: account.id, email: account.email, name: account.name, password: passwordHash, role: account.role },
        });
        await db.tenantMembership.create({ data: { tenantId, userId: account.id, role: account.role } });
      }
      await db.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await db.storeConfiguration.create({
        data: { id: tenantId.replaceAll('-', ''), tenantId, storeName: business.name, autoPurchaseOrder: false, taxRatePercent: 0 },
      });
    });

    const admin = accounts[0];
    await withTenantContext({ tenantId, userId: admin.id, role: 'ADMIN' }, async () => {
      const customers = [];
      for (const { name, phone, city, street, number } of business.customers) {
        const customer = await prisma.customer.create({ data: { name, phone } });
        const address = await prisma.address.create({
          data: { customerId: customer.id, type: 'SHIPPING', city, street, number },
        });
        customers.push({ id: customer.id, addressId: address.id });
      }
      const products = [];
      for (const { name, sku, priceCents, stock } of business.products) {
        products.push(await prisma.product.create({ data: { name, sku, basePriceCents: priceCents, stock } }));
      }
      const orders = getOrdersService();
      for (const [customerIndex, productIndexes] of business.orders) {
        const customer = customers[customerIndex];
        await orders.createOrder(
          {
            customerId: customer.id,
            billingAddressId: customer.addressId,
            shippingAddressId: customer.addressId,
            items: productIndexes.map((index) => ({
              productId: products[index].id,
              sku: products[index].sku,
              name: products[index].name,
              quantity: 1,
              pricePerUnit: products[index].basePriceCents / 100,
            })),
          },
          admin.id
        );
      }
    });
    console.log(`Seeded ${business.name}: ${accounts.map((account) => account.email).join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabaseConnection());

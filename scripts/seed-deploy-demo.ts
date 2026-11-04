#!/usr/bin/env tsx
import {
  AddressType,
  OrderChannel,
  OrderStatus,
  PrismaClient,
  VatCategory,
} from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_TARGET_COUNT = 10;

const cities = [
  { city: 'תל אביב', street: 'דיזנגוף', lat: 32.0853, lng: 34.7818 },
  { city: 'ירושלים', street: 'בן יהודה', lat: 31.7683, lng: 35.2137 },
  { city: 'חיפה', street: 'הנביאים', lat: 32.794, lng: 34.9896 },
  { city: 'באר שבע', street: 'הרצל', lat: 31.2518, lng: 34.7913 },
  { city: 'אשדוד', street: 'הים', lat: 31.8044, lng: 34.6553 },
];

async function ensureSuppliers() {
  const existing = await prisma.supplier.findMany({ where: { demo: true } });
  if (existing.length >= DEMO_TARGET_COUNT) return existing;

  const toCreate = DEMO_TARGET_COUNT - existing.length;
  const created = await Promise.all(
    Array.from({ length: toCreate }).map((_, idx) =>
      prisma.supplier.create({
        data: {
          name: `Demo Supplier ${existing.length + idx + 1}`,
          govId: `80000000${existing.length + idx}`,
          address: `${cities[idx % cities.length].street} ${idx + 10}, ${cities[idx % cities.length].city}`,
          email: `demo-supplier-${existing.length + idx + 1}@example.com`,
          phone: `+97250000${String(existing.length + idx + 1).padStart(4, '0')}`,
          paymentTerms: 'שוטף+30',
          rating: 4,
          demo: true,
        },
      }),
    ),
  );

  return [...existing, ...created];
}

async function ensureProducts(suppliers: { id: string }[]) {
  const existing = await prisma.product.findMany({ where: { demo: true } });
  if (existing.length >= DEMO_TARGET_COUNT) return existing;

  const toCreate = DEMO_TARGET_COUNT - existing.length;
  const created = await Promise.all(
    Array.from({ length: toCreate }).map((_, idx) => {
      const index = existing.length + idx + 1;
      const supplier = suppliers[(existing.length + idx) % suppliers.length];
      return prisma.product.create({
        data: {
          name: `מוצר דמו ${index}`,
          sku: `DEMO-PROD-${String(index).padStart(3, '0')}`,
          defaultSupplierId: supplier.id,
          basePriceCents: 15000 + index * 100,
          demoStock: 25,
          demo: true,
        },
      });
    }),
  );

  return [...existing, ...created];
}

async function ensureCustomersWithAddresses() {
  const existing = await prisma.customer.findMany({
    where: { demo: true },
    include: { addresses: true },
  });

  const created: typeof existing = [];

  if (existing.length < DEMO_TARGET_COUNT) {
    const toCreate = DEMO_TARGET_COUNT - existing.length;
    for (let idx = 0; idx < toCreate; idx++) {
      const city = cities[idx % cities.length];
      const customer = await prisma.customer.create({
        data: {
          name: `לקוח דמו ${existing.length + idx + 1}`,
          email: `demo-customer-${existing.length + idx + 1}@example.com`,
          phone: `+97251000${String(existing.length + idx + 1).padStart(4, '0')}`,
          demo: true,
          addresses: {
            create: [
              {
                type: AddressType.BILLING,
                city: city.city,
                street: city.street,
                number: `${idx + 1}`,
                lat: city.lat,
                lng: city.lng,
                demo: true,
              },
              {
                type: AddressType.SHIPPING,
                city: city.city,
                street: `${city.street} ${idx + 5}`,
                number: `${idx + 3}`,
                lat: city.lat,
                lng: city.lng,
                demo: true,
              },
            ],
          },
        },
        include: { addresses: true },
      });

      created.push(customer);
    }
  }

  const customers = [...existing, ...created];

  // Ensure every existing customer has both billing and shipping addresses
  for (const customer of customers) {
    const hasBilling = customer.addresses.some(addr => addr.type === AddressType.BILLING);
    const hasShipping = customer.addresses.some(addr => addr.type === AddressType.SHIPPING);
    const city = cities[Math.floor(Math.random() * cities.length)];

    if (!hasBilling) {
      const billing = await prisma.address.create({
        data: {
          customerId: customer.id,
          type: AddressType.BILLING,
          city: city.city,
          street: city.street,
          number: '100',
          lat: city.lat,
          lng: city.lng,
          demo: true,
        },
      });
      customer.addresses.push(billing);
    }

    if (!hasShipping) {
      const shipping = await prisma.address.create({
        data: {
          customerId: customer.id,
          type: AddressType.SHIPPING,
          city: city.city,
          street: `${city.street} ${Math.floor(Math.random() * 20) + 1}`,
          number: '200',
          lat: city.lat,
          lng: city.lng,
          demo: true,
        },
      });
      customer.addresses.push(shipping);
    }
  }

  return customers;
}

async function ensureOrders(products: { id: string; name: string; sku: string }[], customers: Awaited<ReturnType<typeof ensureCustomersWithAddresses>>) {
  const existingCount = await prisma.order.count({ where: { demo: true } });
  if (existingCount >= DEMO_TARGET_COUNT) return;

  const toCreate = DEMO_TARGET_COUNT - existingCount;

  for (let idx = 0; idx < toCreate; idx++) {
    const product = products[(existingCount + idx) % products.length];
    const customer = customers[(existingCount + idx) % customers.length];
    const billing = customer.addresses.find(addr => addr.type === AddressType.BILLING)!;
    const shipping = customer.addresses.find(addr => addr.type === AddressType.SHIPPING)!;

    const qty = 1 + (idx % 3);
    const priceCents = 10000 + (existingCount + idx) * 250;
    const taxCents = Math.round(priceCents * qty * 0.17);
    const totalCents = priceCents * qty + taxCents;

    await prisma.order.create({
      data: {
        number: `DEMO-ORD-${String(existingCount + idx + 1).padStart(4, '0')}`,
        status: OrderStatus.TO_DO,
        customerId: customer.id,
        billingAddressId: billing.id,
        shippingAddressId: shipping.id,
        channel: OrderChannel.MANUAL,
        currency: 'ILS',
        subTotalCents: priceCents * qty,
        taxCents,
        totalCents,
        city: shipping.city,
        addressLine: `${shipping.street} ${shipping.number}`,
        lat: shipping.lat,
        lng: shipping.lng,
        demo: true,
        items: {
          create: {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            qty,
            priceCents,
            totalCents,
            vatCategory: VatCategory.STANDARD,
            taxRate: 0.17,
            received: false,
            receivedQuantity: 0,
            demo: true,
          },
        },
      },
    });
  }
}

async function main() {
  console.log('🔄 Ensuring deploy demo data (idempotent)...');

  const suppliers = await ensureSuppliers();
  console.log(`Suppliers ready: ${suppliers.length}`);

  const products = await ensureProducts(suppliers);
  console.log(`Products ready: ${products.length}`);

  const customers = await ensureCustomersWithAddresses();
  console.log(`Customers ready: ${customers.length}`);

  await ensureOrders(products, customers);
  const orderCount = await prisma.order.count({ where: { demo: true } });
  console.log(`Orders ready: ${orderCount}`);

  console.log('✅ Demo dataset ensured.');
}

main()
  .catch(err => {
    console.error('Failed to seed deploy demo data', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

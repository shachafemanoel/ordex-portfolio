import 'dotenv/config';

import { hashPassword } from '@/lib/auth/hash';
import { faker } from '@faker-js/faker';
import {
  AddressType,
  Customer,
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Prisma,
  Product,
  PurchaseOrderStatus,
  Supplier,
  TaskPriority,
  TaskType,
  User,
  UserRole,
  VatCategory,
} from '@prisma/client';
import {
  getDefaultAdminEmail,
  getDefaultAdminName,
  getDefaultAdminPassword,
} from '../lib/auth/defaults';
import { getBasePrismaClient } from '@/lib/db';
import { upsertCustomerMessageTemplateLibrary } from '../lib/message-templates/upsertCustomerTemplateLibrary';

const prisma = getBasePrismaClient();

// Configuration
const COUNTS = {
  TO_DO: 3,
  CALL_BACK: 2,
  AWAITING_STOCK: 3,
  PARTIALLY_SUPPLIED: 3,
  READY_FOR_INSTALL: 3,
  SCHEDULED: 3,
  COMPLETED: 3,
  CANCELLED: 2,
};

type OrderRef = Pick<Order, 'id'>;
type OrderItemReceiptRef = Pick<OrderItem, 'id' | 'qty' | 'productId'>;
type PurchaseOrderRef = { id: string; supplierId: string };
type SeedRole = { role: UserRole; email: string; name: string; isDefault?: boolean };

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PROD_SEED) {
    console.error('❌ Aborting seed in production without ALLOW_PROD_SEED=true');
    process.exit(1);
  }

  try {
    await clean();

    console.log('🏗️  Creating base data...');
    const users = await createUsers();
    const suppliers = await createSuppliers();
    const { products } = await createProductsAndSuppliers(suppliers);
    const customers = await createCustomers();

    const { upserted: customerTemplateCount } = await upsertCustomerMessageTemplateLibrary(prisma);
    console.log(`📨 ספריית תבניות ללקוח: ${customerTemplateCount} רשומות (upsert)`);

    console.log('🎬 Creating scenarios...');

    await createScenarios(users, customers, products, suppliers);

    console.log('🔍 Validating invariants...');
    await validateInvariants();

    console.log('✅ Seed complete!');
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function clean(): Promise<void> {
  console.log('🧹 Cleaning demo data...');
  // Delete everything marked as demo
  // Order matters for FKs
  await prisma.receivingItem.deleteMany({});
  await prisma.goodsReceipt.deleteMany({});

  await prisma.purchaseOrderItem.deleteMany({ where: { demo: true } });
  await prisma.purchaseOrder.deleteMany({ where: { demo: true } });

  await prisma.orderItem.deleteMany({ where: { demo: true } });
  await prisma.calendarEvent.deleteMany({ where: { demo: true } });
  await prisma.task.deleteMany({ where: { order: { demo: true } } });
  await prisma.payment.deleteMany({ where: { demo: true } });
  await prisma.shipment.deleteMany({ where: { demo: true } });
  await prisma.statusHistory.deleteMany({ where: { demo: true } });
  await prisma.orderNote.deleteMany({ where: { demo: true } });

  await prisma.order.deleteMany({ where: { demo: true } });

  await prisma.order.deleteMany({ where: { demo: true } });

  await prisma.address.deleteMany({ where: { demo: true } });
  await prisma.customer.deleteMany({ where: { demo: true } });

  await prisma.productSupplier.deleteMany({ where: { demo: true } });
  await prisma.product.deleteMany({ where: { demo: true } });
  await prisma.supplier.deleteMany({ where: { demo: true } });
  await prisma.user.deleteMany({ where: { demo: true } });
}

// --- Base Data Creators ---

async function createUsers(): Promise<User[]> {
  const users: User[] = [];

  const defaultAdminPassword = getDefaultAdminPassword();
  const passwordHash = await hashPassword(defaultAdminPassword);

  const roles: SeedRole[] = [
    {
      role: UserRole.ADMIN,
      email: getDefaultAdminEmail(),
      name: getDefaultAdminName(),
      isDefault: true,
    },
    { role: UserRole.OPERATIONS, email: 'worker@ordex.demo', name: 'עובד כללי' },
  ];

  for (const roleConfig of roles) {
    const { email, name, role, isDefault = false } = roleConfig;
    const data: Prisma.UserCreateInput = {
      email,
      name,
      role,
      isActive: true,
      demo: true,
      phone: faker.phone.number(),
      ...(isDefault ? { password: passwordHash } : {}),
    };

    const user = await prisma.user.upsert({
      where: { email },
      update: { demo: true, ...(isDefault ? { password: passwordHash } : {}) },
      create: data,
    });
    users.push(user);
  }

  // Add some random users
  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email({ provider: 'ordex.demo' }),
        name: faker.person.fullName(),
        role: faker.helpers.arrayElement([UserRole.ADMIN, UserRole.OPERATIONS]),
        isActive: true,
        demo: true,
        phone: faker.phone.number(),
      },
    });
    users.push(user);
  }

  return users;
}

async function createSuppliers(): Promise<Supplier[]> {
  const suppliers: Supplier[] = [];
  for (let i = 0; i < 3; i++) {
    const s = await prisma.supplier.create({
      data: {
        name: faker.company.name() + ' Supplies',
        govId: faker.string.numeric(9),
        address: faker.location.streetAddress({ useFullAddress: true }),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        demo: true,
      },
    });
    suppliers.push(s);
  }
  return suppliers;
}

async function createProductsAndSuppliers(suppliers: Supplier[]): Promise<{ products: Product[] }> {
  const products: Product[] = [];

  for (let i = 0; i < 15; i++) {
    const supplier = faker.helpers.arrayElement(suppliers);
    const id = faker.string.uuid();
    const code = `SKU-${faker.string.alphanumeric(6).toUpperCase()}`;
    const name = faker.commerce.productName();
    const cost = parseFloat(faker.commerce.price({ min: 10, max: 500 }));

    // Create Product (Catalog)
    const product = await prisma.product.create({
      data: {
        id,
        name,
        sku: code,
        defaultSupplierId: supplier.id,
        demo: true,
        basePriceCents: Math.round(cost * 1.5 * 100), // 50% margin
        stock: 100,
      },
    });
    products.push(product);

    // Create link
    await prisma.productSupplier.create({
      data: {
        productId: product.id,
        supplierId: supplier.id,
        demo: true,
      },
    });
  }
  return { products };
}

async function createCustomers(): Promise<Customer[]> {
  const customers: Customer[] = [];
  for (let i = 0; i < 10; i++) {
    const c = await prisma.customer.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        demo: true,
        addresses: {
          create: [
            {
              type: AddressType.BILLING,
              city: faker.location.city(),
              street: faker.location.street(),
              number: faker.location.buildingNumber(),
              demo: true,
            },
            {
              type: AddressType.SHIPPING,
              city: faker.location.city(),
              street: faker.location.street(),
              number: faker.location.buildingNumber(),
              demo: true,
            },
          ],
        },
      },
    });
    customers.push(c);
  }
  return customers;
}

// --- Scenario Builders ---

async function createScenarios(
  users: User[],
  customers: Customer[],
  products: Product[],
  suppliers: Supplier[]
): Promise<void> {
  const salesUsers = users.filter((u) => u.role === UserRole.SALES || u.role === UserRole.ADMIN);
  const opsUsers = users.filter((u) => u.role === UserRole.OPERATIONS || u.role === UserRole.ADMIN);
  const installers = users.filter((u) => u.role === UserRole.INSTALLER);

  // Helper to pick random entity
  const pick = <T>(arr: T[]) => faker.helpers.arrayElement(arr);

  // 1. TO_DO
  for (let i = 0; i < COUNTS.TO_DO; i++) {
    await createOrder(pick(customers), pick(salesUsers), products, OrderStatus.TO_DO);
  }

  // 2. CALL_BACK
  for (let i = 0; i < COUNTS.CALL_BACK; i++) {
    const order = await createOrder(
      pick(customers),
      pick(salesUsers),
      products,
      OrderStatus.CALL_BACK
    );
    await prisma.task.create({
      data: {
        orderId: order.id,
        type: TaskType.CALL_BACK,
        priority: TaskPriority.HIGH,
        status: 'OPEN',
        notes: 'Customer requested callback regarding dimensions.',
        assigneeId: order.assignedUserId,
      },
    });
  }

  // 3. AWAITING_STOCK
  for (let i = 0; i < COUNTS.AWAITING_STOCK; i++) {
    const order = await createOrder(
      pick(customers),
      pick(salesUsers),
      products,
      OrderStatus.AWAITING_STOCK
    );
    // Create PO(s) for this order
    await createPurchaseOrdersForOrder(order, PurchaseOrderStatus.SENT);
  }

  // 4. PARTIALLY_SUPPLIED
  for (let i = 0; i < COUNTS.PARTIALLY_SUPPLIED; i++) {
    // Ensure at least 2 items to allow partial supply
    const order = await createOrder(
      pick(customers),
      pick(salesUsers),
      products,
      OrderStatus.PARTIALLY_SUPPLIED,
      2
    );
    const pos = await createPurchaseOrdersForOrder(order, PurchaseOrderStatus.PARTIALLY_RECEIVED);
    // Receive one item fully, leave other pending
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    if (items.length > 0) {
      await receiveItem(order, items[0], pos);
    }
  }

  // 5. READY_FOR_INSTALL
  for (let i = 0; i < COUNTS.READY_FOR_INSTALL; i++) {
    const order = await createOrder(
      pick(customers),
      pick(salesUsers),
      products,
      OrderStatus.READY_FOR_INSTALL
    );
    const pos = await createPurchaseOrdersForOrder(order, PurchaseOrderStatus.RECEIVED);
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      await receiveItem(order, item, pos);
    }
  }

  // 6. SCHEDULED
  for (let i = 0; i < COUNTS.SCHEDULED; i++) {
    const order = await createOrder(
      pick(customers),
      pick(salesUsers),
      products,
      OrderStatus.SCHEDULED
    );
    const pos = await createPurchaseOrdersForOrder(order, PurchaseOrderStatus.RECEIVED);
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      await receiveItem(order, item, pos);
    }

    // Schedule it
    const scheduledAt = faker.date.soon({ days: 10 });
    const installer = pick(installers) || users[0];

    await prisma.order.update({
      where: { id: order.id },
      data: {
        scheduledAt,
        assignedUserId: installer.id,
        installerName: installer.name,
      },
    });

    await prisma.calendarEvent.create({
      data: {
        orderId: order.id,
        title: `Install ${order.number}`,
        startTime: scheduledAt,
        endTime: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours
        assignedTo: installer.id,
        demo: true,
      },
    });
  }

  // 7. COMPLETED
  for (let i = 0; i < COUNTS.COMPLETED; i++) {
    const order = await createOrder(
      pick(customers),
      pick(salesUsers),
      products,
      OrderStatus.COMPLETED
    );
    const pos = await createPurchaseOrdersForOrder(order, PurchaseOrderStatus.RECEIVED);
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      await receiveItem(order, item, pos);
    }

    const scheduledAt = faker.date.recent({ days: 30 });
    const completedAt = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
    const installer = pick(installers) || users[0];

    await prisma.order.update({
      where: { id: order.id },
      data: {
        scheduledAt,
        completedAt,
        paymentStatus: PaymentStatus.PAID,
        paidAmountCents: order.totalCents,
        assignedUserId: installer.id,
      },
    });

    // Create a calendar event in the past
    await prisma.calendarEvent.create({
      data: {
        orderId: order.id,
        title: `Install ${order.number}`,
        startTime: scheduledAt,
        endTime: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000),
        assignedTo: installer.id,
        status: 'DONE',
        demo: true,
      },
    });
  }

  // 8. CANCELLED
  for (let i = 0; i < COUNTS.CANCELLED; i++) {
    await createOrder(pick(customers), pick(salesUsers), products, OrderStatus.CANCELLED);
    // No POs for cancelled orders usually, or POs are cancelled too.
    // We'll leave it without POs for simplicity as per requirement "No open purchase orders".
  }
}

// --- Helpers ---

async function createOrder(
  customer: Customer,
  user: User,
  products: Product[],
  status: OrderStatus,
  minItems = 1
): Promise<Order> {
  const billingAddr = await prisma.address.findFirst({
    where: { customerId: customer.id, type: AddressType.BILLING },
  });
  const shippingAddr = await prisma.address.findFirst({
    where: { customerId: customer.id, type: AddressType.SHIPPING },
  });

  const numItems = faker.number.int({ min: minItems, max: 5 });
  const itemsData = [];
  let subTotal = 0;

  for (let i = 0; i < numItems; i++) {
    const product = faker.helpers.arrayElement(products);
    const qty = faker.number.int({ min: 1, max: 5 });
    const price = product.basePriceCents || 1000;
    const total = qty * price;
    subTotal += total;

    itemsData.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      qty,
      priceCents: price,
      totalCents: total,
      vatCategory: VatCategory.STANDARD,
      demo: true,
    });
  }

  // VAT Included Model: Sum of items is the Total
  const total = subTotal;
  const tax = Math.round(total - total / 1.17);
  const subTotalExTax = total - tax;

  return await prisma.order.create({
    data: {
      number: `DEMO-${faker.string.alphanumeric(8).toUpperCase()}`,
      status,
      customerId: customer.id,
      billingAddressId: billingAddr!.id,
      shippingAddressId: shippingAddr!.id,
      assignedUserId: user.id,
      subTotalCents: subTotalExTax, // Store ex-tax amount
      taxCents: tax,
      totalCents: total,
      currency: 'ILS',
      channel: OrderChannel.MANUAL,
      demo: true,
      city: shippingAddr?.city,
      addressLine: `${shippingAddr?.street} ${shippingAddr?.number}`,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      items: { create: itemsData },
    },
  });
}

async function createPurchaseOrdersForOrder(
  order: OrderRef,
  status: PurchaseOrderStatus
): Promise<PurchaseOrderRef[]> {
  // Group items by supplier
  const items = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    include: { product: true },
  });

  const supplierItems = new Map<string, typeof items>();

  for (const item of items) {
    const supplierId = item.product?.defaultSupplierId;
    if (!supplierId) continue;
    if (!supplierItems.has(supplierId)) supplierItems.set(supplierId, []);
    supplierItems.get(supplierId)!.push(item);
  }

  const pos: PurchaseOrderRef[] = [];

  for (const [supplierId, sItems] of Array.from(supplierItems.entries())) {
    // Aggregate quantities by product (in case same product appears multiple times)
    const productQty = new Map<string, number>();
    for (const item of sItems) {
      if (!item.productId) continue;
      const current = productQty.get(item.productId) || 0;
      productQty.set(item.productId, current + item.qty);
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        status,
        reference: `PO-DEMO-${faker.string.alphanumeric(8).toUpperCase()}`,
        linkedOrderIds: [order.id],
        demo: true,
        items: {
          create: Array.from(productQty.entries()).map(([productId, qty]) => ({
            productId,
            qtyOrdered: qty,
            qtyReceived: status === PurchaseOrderStatus.RECEIVED ? qty : 0,
            demo: true,
          })),
        },
      },
    });
    pos.push({ id: po.id, supplierId: po.supplierId });
  }

  return pos;
}

async function receiveItem(
  _order: OrderRef,
  orderItem: OrderItemReceiptRef,
  pos: PurchaseOrderRef[]
): Promise<void> {
  // Find relevant PO item
  for (const po of pos) {
    const poItem = await prisma.purchaseOrderItem.findFirst({
      where: { purchaseOrderId: po.id, productId: orderItem.productId ?? undefined },
    });

    if (poItem) {
      // 1. Update PO Item
      await prisma.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { qtyReceived: orderItem.qty },
      });

      // 2. Update Order Item
      await prisma.orderItem.update({
        where: { id: orderItem.id },
        data: { received: true, receivedQuantity: orderItem.qty },
      });

      // 3. Create Goods Receipt
      const gr = await prisma.goodsReceipt.create({
        data: {
          supplier: { connect: { id: po.supplierId } },
          purchaseOrder: { connect: { id: po.id } },
          reference: `GR-${faker.string.alphanumeric(6)}`,
        },
      });

      // 4. Create Receiving Item
      await prisma.receivingItem.create({
        data: {
          goodsReceiptId: gr.id,
          orderItemId: orderItem.id,
          skuId: orderItem.productId ?? null,
          quantityReceived: orderItem.qty,
        },
      });

      // 5. Update Stock (Product)
      if (orderItem.productId) {
        await prisma.product.update({
          where: { id: orderItem.productId },
          data: { stock: { increment: orderItem.qty } },
        });
      }

      break;
    }
  }
}

// --- Validation ---

async function validateInvariants(): Promise<void> {
  const errors: string[] = [];

  // 1. SCHEDULED/READY_FOR_INSTALL must have all items received
  // Note: Prisma doesn't support field comparison, so we check differently
  const ordersToCheck = await prisma.order.findMany({
    where: {
      status: { in: [OrderStatus.SCHEDULED, OrderStatus.READY_FOR_INSTALL] },
      demo: true,
    },
    include: {
      items: {
        select: {
          id: true,
          qty: true,
          receivedQuantity: true,
        },
      },
    },
  });

  const notReceived = ordersToCheck.find((order) =>
    order.items.some((item) => item.receivedQuantity < item.qty)
  );
  if (notReceived)
    errors.push(`Order ${notReceived.number} is ${notReceived.status} but has unreceived items.`);

  // 2. SCHEDULED must have scheduledAt
  const unscheduled = await prisma.order.findFirst({
    where: {
      status: OrderStatus.SCHEDULED,
      scheduledAt: null,
      demo: true,
    },
  });
  if (unscheduled) errors.push(`Order ${unscheduled.number} is SCHEDULED but scheduledAt is null.`);

  // 3. COMPLETED must have all POs RECEIVED
  const orders = await prisma.order.findMany({
    where: { status: OrderStatus.COMPLETED, demo: true },
  });
  for (const o of orders) {
    // Find linked POs by linkedOrderIds array check
    const pos = await prisma.purchaseOrder.findMany({
      where: { linkedOrderIds: { has: o.id } },
    });
    const notReceivedPO = pos.find((p) => p.status !== PurchaseOrderStatus.RECEIVED);
    if (notReceivedPO)
      errors.push(
        `Order ${o.number} is COMPLETED but PO ${notReceivedPO.reference} is ${notReceivedPO.status}.`
      );
  }

  if (errors.length > 0) {
    console.error('❌ Validation Errors:');
    errors.forEach((e) => console.error(` - ${e}`));
    throw new Error('Invariant validation failed');
  } else {
    console.log('✅ All invariants passed.');
  }
}

main().catch((e: any) => {
  console.error(e);
  process.exit(1);
});

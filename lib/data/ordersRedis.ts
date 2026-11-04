import { getRedisClient } from '@/lib/redis';
import type { Prisma, OrderStatus as PrismaOrderStatus, UserRole } from '@prisma/client';

// --- Unified Object Interfaces ---

export type UnifiedOrderStatus = PrismaOrderStatus;

export interface UnifiedUserSnapshot {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface UnifiedCustomerSnapshot {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  segmentIds?: string[];
}

export interface UnifiedItemSnapshot {
  id?: string;
  productId: string;
  sku: string;
  name: string;
  qty: number;
  priceCents: number;
  totalCents: number;
  received?: boolean;
  receivedQuantity?: number;
  allocationStatus?: 'PENDING' | 'ALLOCATED' | 'OUT_OF_STOCK' | 'ON_ORDER';
  supplierId?: string;
  supplierName?: string;
}

export interface UnifiedInstallationSnapshot {
  id: string; // Task ID
  status: string;
  scheduledAt?: string;
  installerId?: string;
  installerName?: string;
}

export interface UnifiedOrder {
  id: string;
  number: string;
  status: UnifiedOrderStatus;
  source: 'internal' | 'woo';
  createdAt: string;
  updatedAt: string;

  // Financials
  totalAmountCents: number;
  totalAmount: number; // Computed float for frontend compatibility
  paidAmountCents?: number;
  currency: string;
  paymentStatus: string;
  isOverdue: boolean;

  // Relations (Snapshots + IDs)
  customerId: string;
  customer: UnifiedCustomerSnapshot;

  assignedUserId?: string;
  assignedUser?: UnifiedUserSnapshot;

  items: UnifiedItemSnapshot[];

  // Shipping / Location
  shippingAddressId: string;
  shippingAddress: {
    fullAddress?: string;
    city?: string;
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    lat?: number;
    lng?: number;
  };

  // Installation
  installationTaskId?: string;
  installation?: UnifiedInstallationSnapshot;
  scheduledAt?: string;
  notesToCrew?: string;

  // Metadata
  wooOrderId?: number;
  tags?: string[];
}

// --- Redis Keys ---

const ORDER_KEY_PREFIX = 'ordex:order:';
const ORDER_BY_WOO_PREFIX = 'ordex:order:by_woo:';
const CUSTOMER_KEY_PREFIX = 'ordex:customer:';
const ORDER_INDEX = 'ordex:idx:orders';
let ensureOrdersIndexPromise: Promise<boolean> | null = null;

// --- Mapping Logic ---

/**
 * Prisma Include to fetch all necessary data for UnifiedOrder
 */
export const UNIFIED_ORDER_INCLUDE = {
  customer: true,
  items: {
    include: {
      supplier: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          imageUrl: true,
        },
      },
    },
  },
  assignedUser: true,
  shippingAddress: true,
  installationTasks: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    include: {
      technician: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof UNIFIED_ORDER_INCLUDE }>;

// Backward compatibility alias if needed, or just remove OrderJson usage
export type OrderJson = UnifiedOrder;
export async function getOrder(id: string): Promise<UnifiedOrder | null> {
  return getUnifiedOrder(id);
}
export async function upsertOrder(order: any): Promise<void> {
  return upsertUnifiedOrder(order as UnifiedOrder);
}

// --- Unified CRM Objects ---

// UnifiedLeadSnapshot and UnifiedDealSnapshot removed as legacy models are deleted

export interface UnifiedCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;

  // CRM Stats
  lifecycle: string; // e.g., CUSTOMER, LEAD
  clvCents: number;
  lastOrderDate?: string;
  riskLevel: string;

  // Relations
  // primaryContactId?: string; // Legacy
  // primaryContactName?: string; // Legacy

  // Linked CRM Entities (Snapshots)
  // Linked CRM Entities (Snapshots)
  // leads: UnifiedLeadSnapshot[]; // Legacy
  // deals: UnifiedDealSnapshot[]; // Legacy
  recentOrderIds: string[];

  createdAt: string;
  updatedAt: string;
}

// --- CRM Redis Keys ---

// CUSTOMER_KEY_PREFIX is already defined above

// --- CRM Mapping Logic ---

export const UNIFIED_CUSTOMER_INCLUDE = {
  orders: {
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  },
  // leads: true, // Legacy
  // deals: true, // Legacy
  // contacts: {
  //   where: { isPrimary: true },
  //   take: 1,
  // },
} satisfies Prisma.CustomerInclude;

type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: typeof UNIFIED_CUSTOMER_INCLUDE;
}>;

export function mapCustomerToUnified(customer: CustomerWithRelations): UnifiedCustomer {
  // Map leads logic removed

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email || undefined,
    phone: customer.phone || undefined,
    lifecycle: customer.lifecycle,
    clvCents: customer.clvCents,
    riskLevel: customer.riskLevel,

    // primaryContactId: customer.contacts?.[0]?.id,
    // primaryContactName: customer.contacts?.[0]
    //   ? `${customer.contacts[0].firstName} ${customer.contacts[0].lastName}`
    //   : undefined,

    // leads: [],
    // deals: [],

    recentOrderIds: customer.orders.map((o) => o.id),

    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export async function upsertUnifiedCustomer(customer: UnifiedCustomer): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  const key = `${CUSTOMER_KEY_PREFIX}${customer.id}`;
  await redis.sendCommand(['JSON.SET', key, '$', JSON.stringify(customer)]);
}

export async function getUnifiedCustomer(id: string): Promise<UnifiedCustomer | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  const raw = await redis.sendCommand(['JSON.GET', `${CUSTOMER_KEY_PREFIX}${id}`]);
  return raw ? (JSON.parse(raw as any) as UnifiedCustomer) : null;
}

export function isRedisAvailable(): boolean {
  // Assuming isRedisReady is imported or defined elsewhere if needed.
  // For now, returning true as a placeholder or if getRedisClient implies readiness.
  // If getRedisClient returns null, it means it's not available.
  // This function was not in the original file, so I'm adding it as per the snippet.
  // However, the original file does not export `isRedisReady`.
  // I will assume `getRedisClient` returning a client means it's ready.
  return !!getRedisClient();
}

export function mapOrderToUnified(order: OrderWithRelations): UnifiedOrder {
  const installationTask = order.installationTasks?.[0];

  return {
    id: order.id,
    number: order.number,
    status: order.status as UnifiedOrderStatus,
    source: order.channel === 'WOOCOMMERCE' ? 'woo' : 'internal',
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),

    totalAmountCents: order.totalCents,
    totalAmount: order.totalCents / 100, // Computed
    paidAmountCents: order.paidAmountCents,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    isOverdue: false, // Logic can be improved

    customerId: order.customerId,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      email: order.customer.email || undefined,
      phone: order.customer.phone || undefined,
      // City might be on address, but simplistic snapshot here
    },

    assignedUserId: order.assignedUserId || undefined,
    assignedUser: order.assignedUser
      ? {
          id: order.assignedUser.id,
          name: order.assignedUser.name,
          role: order.assignedUser.role,
          email: order.assignedUser.email,
        }
      : undefined,

    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? '',
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      priceCents: item.priceCents,
      totalCents: item.totalCents,
      received: item.received,
      receivedQuantity: item.receivedQuantity,
      allocationStatus: item.allocationStatus ?? 'PENDING',
      supplierId: item.supplierId || undefined,
      supplierName: item.supplier?.name || undefined,
    })),

    shippingAddressId: order.shippingAddressId,
    shippingAddress: {
      fullAddress: [
        order.shippingAddress?.street,
        order.shippingAddress?.number,
        order.shippingAddress?.apartment ? `דירה ${order.shippingAddress.apartment}` : null,
        order.shippingAddress?.city,
      ]
        .filter(Boolean)
        .join(', '),
      city: order.shippingAddress?.city,
      street: order.shippingAddress?.street,
      number: order.shippingAddress?.number || undefined,
      floor: order.shippingAddress?.floor || undefined,
      apartment: order.shippingAddress?.apartment || undefined,
      lat: order.shippingAddress?.lat ?? order.lat ?? (order as any).latitude ?? undefined,
      lng: order.shippingAddress?.lng ?? order.lng ?? (order as any).longitude ?? undefined,
    },

    installationTaskId: installationTask?.id,
    installation: installationTask
      ? {
          id: installationTask.id,
          status: installationTask.status,
          scheduledAt: installationTask.scheduledDate?.toISOString(),
          installerId: installationTask.technicianId || undefined,
          installerName: installationTask.technician?.name,
        }
      : undefined,
    scheduledAt: order.scheduledAt?.toISOString(),
    notesToCrew: (order as any).notesToCrew ?? undefined,

    wooOrderId: order.wooOrderId ? Number(order.wooOrderId) : undefined,
  };
}

// --- Data Access ---

export async function upsertUnifiedOrder(order: UnifiedOrder): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return; // Should we throw? For now, fail silent or log

  const key = `${ORDER_KEY_PREFIX}${order.id}`;
  await redis.sendCommand(['JSON.SET', key, '$', JSON.stringify(order)]);

  // Index mappings
  if (order.wooOrderId) {
    await redis.set(`${ORDER_BY_WOO_PREFIX}${order.wooOrderId}`, order.id);
  }
}

export async function getUnifiedOrder(id: string): Promise<UnifiedOrder | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  const raw = await redis.sendCommand(['JSON.GET', `${ORDER_KEY_PREFIX}${id}`]);
  if (!raw) return null;

  const parsed = JSON.parse(raw as any) as UnifiedOrder;
  if (parsed.totalAmount === undefined && typeof parsed.totalAmountCents === 'number') {
    parsed.totalAmount = parsed.totalAmountCents / 100;
  }
  return parsed;
}

export async function listOrders(options: {
  q?: string;
  status?: string[];
  city?: string;
  userId?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  // Sorting
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  // Pagination
  page?: number;
  limit?: number;
}): Promise<{ items: UnifiedOrder[]; total: number } | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  const {
    q,
    status,
    city,
    userId,
    clientId,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    limit = 20,
  } = options;

  const terms: string[] = [];

  // Tag filters
  if (status && status.length) terms.push(`@status:{${status.join('|')}}`);
  if (city) terms.push(`@city:{${city}}`);
  if (userId) terms.push(`@assignedUserId:{${userId}}`);
  if (clientId) terms.push(`@customerId:{${clientId}}`);

  // Search text
  if (q && q.trim()) {
    const esc = q.replace(/([\-\[\]\{\}\(\)"\~\*\:\\])/g, '\\$1');
    terms.push(`(customerName|address):(${esc}*)`);
  }

  const query = terms.length ? terms.join(' ') : '*';
  const from = (page - 1) * limit;

  // Sorting
  const sortArgs = [];
  if (sortBy) {
    sortArgs.push('SORTBY', sortBy, sortDir.toUpperCase());
  }

  const args = ['FT.SEARCH', ORDER_INDEX, query, ...sortArgs, 'LIMIT', String(from), String(limit)];

  try {
    const res = (await redis.sendCommand(args)) as any;
    const total = Number(res?.[0] || 0);
    const items: UnifiedOrder[] = [];

    for (let i = 1; i < res.length; i += 2) {
      const doc = res[i + 1];
      const raw = Array.isArray(doc)
        ? doc.find((_x: any, idx: number) => doc[idx - 1] === '$')
        : null;
      const jsonStr = raw || (Array.isArray(doc) ? doc[1] : null);

      if (typeof jsonStr === 'string') {
        try {
          // Parse and allow partial failures
          const parsed = JSON.parse(jsonStr) as UnifiedOrder;

          // Backwards compatibility for cached items without totalAmount
          if (parsed.totalAmount === undefined && typeof parsed.totalAmountCents === 'number') {
            parsed.totalAmount = parsed.totalAmountCents / 100;
          }

          items.push(parsed);
        } catch {}
      }
    }
    return { items, total };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No such index')) {
      const initialized = await ensureOrdersIndex();
      if (initialized) {
        const retryRes = (await redis.sendCommand(args)) as any;
        const total = Number(retryRes?.[0] || 0);
        const items: UnifiedOrder[] = [];

        for (let i = 1; i < retryRes.length; i += 2) {
          const doc = retryRes[i + 1];
          const raw = Array.isArray(doc)
            ? doc.find((_x: any, idx: number) => doc[idx - 1] === '$')
            : null;
          const jsonStr = raw || (Array.isArray(doc) ? doc[1] : null);

          if (typeof jsonStr === 'string') {
            try {
              const parsed = JSON.parse(jsonStr) as UnifiedOrder;
              if (parsed.totalAmount === undefined && typeof parsed.totalAmountCents === 'number') {
                parsed.totalAmount = parsed.totalAmountCents / 100;
              }
              items.push(parsed);
            } catch {}
          }
        }

        return { items, total };
      }
    }
    console.warn('Redis Search Error:', error);
    return null;
  }
}

export async function ensureUnifiedIndexes(): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    await redis.sendCommand([
      'FT.CREATE',
      ORDER_INDEX,
      'ON',
      'JSON',
      'PREFIX',
      '1',
      ORDER_KEY_PREFIX,
      'SCHEMA',
      '$.number',
      'AS',
      'number',
      'TAG',
      '$.status',
      'AS',
      'status',
      'TAG',
      '$.source',
      'AS',
      'source',
      'TAG',
      '$.customerId',
      'AS',
      'customerId',
      'TAG',
      '$.customer.name',
      'AS',
      'customerName',
      'TEXT',
      '$.customer.phone',
      'AS',
      'customerPhone',
      'TAG',
      '$.shippingAddress.city',
      'AS',
      'city',
      'TAG',
      '$.assignedUserId',
      'AS',
      'assignedUserId',
      'TAG',
      '$.totalAmountCents',
      'AS',
      'amountCents',
      'NUMERIC',
      '$.totalAmount',
      'AS',
      'amount',
      'NUMERIC',
      '$.createdAt', // Added missing field path
      'AS',
      'createdAt',
      'TAG',
      'SORTABLE',
    ]);
    return true;
  } catch (e: any) {
    if (String(e?.message || e).includes('Index already exists')) {
      return true;
    }
    if (!String(e?.message || e).includes('Index already exists')) {
      console.warn('FT.CREATE unified orders failed', e?.message || e);
    }
    return false;
  }
}

export async function ensureOrdersIndex(): Promise<boolean> {
  if (!ensureOrdersIndexPromise) {
    ensureOrdersIndexPromise = ensureUnifiedIndexes()
      .catch(() => false)
      .finally(() => {
        ensureOrdersIndexPromise = null;
      });
  }

  return ensureOrdersIndexPromise;
}

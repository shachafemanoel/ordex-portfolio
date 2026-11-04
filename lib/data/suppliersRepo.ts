
// import { redis } from '@/lib/redis'; // Reserved for Redis operations
import { getRedisClient } from '@/lib/redis';

const SUPPLIER_KEY_PREFIX = 'supplier:';
const SUPPLIER_INDEX_NAME = 'idx:supplier';

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export async function createSupplierIndex() {
  try {
    const client = await getRedisClient();
    if (!client || !(client as any).ft) {
      // Redis not available or RediSearch module missing; skip index creation
      return;
    }
    await ((client as any).ft.create as any)(
      SUPPLIER_INDEX_NAME,
      {
        '$.name': { type: 'TEXT', as: 'name' },
        '$.taxId': { type: 'TEXT', as: 'taxId' },
        '$.email': { type: 'TEXT', as: 'email' },
        '$.phone': { type: 'TEXT', as: 'phone' },
      },
      {
        ON: 'HASH',
        PREFIX: SUPPLIER_KEY_PREFIX,
      }
    );
  } catch (e: any) {
    if (e?.message === 'Index already exists') {
      console.log('Supplier index already exists.');
    } else {
      console.error('Error creating supplier index:', e);
    }
  }
}

export async function createSupplier(data: Omit<Supplier, 'id'>): Promise<Supplier> {
  const id = generateId(); // You'll need to implement a random ID generation function
  const key = `${SUPPLIER_KEY_PREFIX}${id}`;
  const supplier: Supplier = { ...data, id };
  const client = await getRedisClient();
  if (!client) throw new Error('Redis unavailable');
  await client.hSet(key, supplier as any);
  return supplier;
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const key = `${SUPPLIER_KEY_PREFIX}${id}`;
  const client = await getRedisClient();
  if (!client) return null;
  const supplier = await client.hGetAll(key);
  if (Object.keys(supplier).length === 0) {
    return null;
  }
  return supplier as any;
}

export async function updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier | null> {
  const key = `${SUPPLIER_KEY_PREFIX}${id}`;
  const client = await getRedisClient();
  if (!client) return null;
  const exists = await client.exists(key);
  if (!exists) {
    return null;
  }
  await client.hSet(key, data as any);
  const updatedSupplier = await getSupplier(id);
  return updatedSupplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  const key = `${SUPPLIER_KEY_PREFIX}${id}`;
  const client = await getRedisClient();
  if (!client) return;
  await client.del(key);
}

export async function listSuppliers(options: { q?: string, limit?: number, cursor?: number }): Promise<{ items: Supplier[], nextCursor?: number }> {
    const { q, limit = 50, cursor = 0 } = options;
    
    const query = q ? `*${q}*` : '*';

    const client = await getRedisClient();
    if (!client || !(client as any).ft) {
      throw new Error('Redis or RediSearch module unavailable');
    }

    const results = await (client as any).ft.search(SUPPLIER_INDEX_NAME, query, {
        LIMIT: { from: cursor, size: limit + 1 }
    });

    const items = results.documents.map((doc: { value: Supplier }) => doc.value as Supplier);
    const hasMore = items.length > limit;
    const paginatedItems = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? cursor + limit : undefined;

    return {
        items: paginatedItems,
        nextCursor
    };
}

export async function findSupplierByTaxIdOrEmail(taxId?: string, email?: string): Promise<Supplier | null> {
    const client = await getRedisClient();
    if (!client || !(client as any).ft) return null;
    if (taxId) {
        const result = await (client as any).ft.search(SUPPLIER_INDEX_NAME, `@taxId:(${taxId})`);
        if ((result?.total ?? 0) > 0) {
            return (result.documents?.[0]?.value as any as Supplier) ?? null;
        }
    }

    if (email) {
        const result = await (client as any).ft.search(SUPPLIER_INDEX_NAME, `@email:(${email})`);
        if ((result?.total ?? 0) > 0) {
            return (result.documents?.[0]?.value as any as Supplier) ?? null;
        }
    }

    return null;
}


function generateId() {
  // This is a placeholder. Use a proper ID generation library like cuid or uuid.
  return Math.random().toString(36).substring(2, 15);
}

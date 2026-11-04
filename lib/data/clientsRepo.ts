
import { redis } from '@/lib/redis';

const CLIENT_KEY_PREFIX = 'client:';
const CLIENT_INDEX_NAME = 'idx:client';

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
}

export async function createClientIndex() {
  try {
    if (!redis?.ft?.create) {
      console.warn('Redis FT (RediSearch) not available, skipping client index creation');
      return;
    }
    
    // Cast to any to accommodate differing RediSearch type signatures
    await (redis.ft.create as any)(
      CLIENT_INDEX_NAME,
      {
        '$.name': { type: 'TEXT', as: 'name' },
        '$.email': { type: 'TEXT', as: 'email' },
        '$.phone': { type: 'TEXT', as: 'phone' },
        '$.city': { type: 'TEXT', as: 'city' },
      },
      {
        ON: 'HASH',
        PREFIX: CLIENT_KEY_PREFIX,
      }
    );
  } catch (e: any) {
    if (e?.message === 'Index already exists') {
      console.log('Client index already exists.');
    } else {
      console.error('Error creating client index:', e);
    }
  }
}

export async function createClient(data: Omit<Client, 'id'>): Promise<Client> {
  const id = generateId(); // You'll need to implement a random ID generation function
  const key = `${CLIENT_KEY_PREFIX}${id}`;
  const client: Client = { ...data, id };
  const redisClient = requireRedis();
  await redisClient.hSet(key, client as any);
  return client;
}

export async function getClient(id: string): Promise<Client | null> {
  const key = `${CLIENT_KEY_PREFIX}${id}`;
  const redisClient = requireRedis();
  const client = await redisClient.hGetAll(key);
  if (Object.keys(client).length === 0) {
    return null;
  }
  return client as any;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client | null> {
  const key = `${CLIENT_KEY_PREFIX}${id}`;
  const redisClient = requireRedis();
  const exists = await redisClient.exists(key);
  if (!exists) {
    return null;
  }
  await redisClient.hSet(key, data as any);
  const updatedClient = await getClient(id);
  return updatedClient;
}

export async function deleteClient(id: string): Promise<void> {
  const key = `${CLIENT_KEY_PREFIX}${id}`;
  const redisClient = requireRedis();
  await redisClient.del(key);
}

export async function listClients(options: { q?: string, limit?: number, cursor?: number }): Promise<{ items: Client[], nextCursor?: number }> {
    const { q, limit = 50, cursor = 0 } = options;
    
    try {
        const query = q ? `*${q}*` : '*';

        if (!redis || !redis.ft) {
            console.warn('Redis FT (RediSearch) not available, returning empty results');
            return { items: [] };
        }

        const results = await redis.ft.search(CLIENT_INDEX_NAME, query, {
            LIMIT: { from: cursor, size: limit + 1 }
        });

        const items = results.documents.map((doc: { value: Client }) => doc.value as Client);
        const hasMore = items.length > limit;
        const paginatedItems = hasMore ? items.slice(0, -1) : items;
        const nextCursor = hasMore ? cursor + limit : undefined;

        return {
            items: paginatedItems,
            nextCursor
        };
    } catch (error) {
        console.error('Error in listClients:', error);
        return { items: [] };
    }
}

export async function findClientByEmailOrPhone(email?: string, phone?: string): Promise<Client | null> {
    try {
        if (!redis || !redis.ft) {
            console.warn('Redis FT (RediSearch) not available, cannot search by email/phone');
            return null;
        }

        if (email) {
            const result = await redis.ft.search(CLIENT_INDEX_NAME, `@email:(${email})`);
            if ((result?.total ?? 0) > 0) {
                return (result.documents?.[0]?.value as any as Client) ?? null;
            }
        }

        if (phone) {
            const result = await redis.ft.search(CLIENT_INDEX_NAME, `@phone:(${phone})`);
            if ((result?.total ?? 0) > 0) {
                return (result.documents?.[0]?.value as any as Client) ?? null;
            }
        }

        return null;
    } catch (error) {
        console.error('Error in findClientByEmailOrPhone:', error);
        return null;
    }
}

function generateId() {
  // This is a placeholder. Use a proper ID generation library like cuid or uuid.
  return Math.random().toString(36).substring(2, 15);
}

function requireRedis() {
  if (!redis) {
    throw new Error('Redis unavailable');
  }
  return redis;
}

import {
  createTestUser,
  loginAs,
  makeApiRequest,
  type TestOrder,
  type TestSession,
  type TestUser,
} from '@/tests/api-test-helpers';
import { seedTestOrders } from '@/tests/seed-helpers';
import { beforeAll, describe, expect, it } from 'vitest';

describe('API Response Shape Consistency', () => {
  let adminUser: TestUser;
  let session: TestSession;
  let seededOrder: TestOrder;

  beforeAll(async () => {
    adminUser = await createTestUser({ role: 'ADMIN' });
    session = await loginAs(adminUser);
    const orders = await seedTestOrders([{ createdById: adminUser.id, status: 'CONFIRMED' }]);
    seededOrder = orders[0];
  });

  describe('/api/orders (List Endpoint)', () => {
    it('should return a list of items with pagination metadata', async () => {
      const response = await makeApiRequest('/api/orders?page=1&limit=10', {
        headers: session.headers,
      });
      expect(response.status).toBe(200);

      const body = await response.json();

      // Assert canonical list response shape
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
      expect(body).toHaveProperty('pagination');
      expect(body.pagination).toEqual({
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
        currentPage: 1,
        limit: 10,
      });

      // Assert shape of an individual item in the list
      if (body.items.length > 0) {
        const order = body.items[0];
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('client');
        expect(order).toHaveProperty('total');
      }
    });
  });

  describe('/api/orders/:id (Single Resource Endpoint)', () => {
    it('should return a single resource wrapped in a `data` object', async () => {
      const response = await makeApiRequest(`/api/orders/${seededOrder.id}`, {
        headers: session.headers,
      });
      expect(response.status).toBe(200);

      const body = await response.json();

      // Assert canonical single resource shape
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
      expect(body.data).not.toBeNull();

      // Assert shape of the data object
      const order = body.data;
      expect(order).toHaveProperty('id', seededOrder.id);
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('client');
      expect(order).toHaveProperty('lineItems');
    });
  });
});

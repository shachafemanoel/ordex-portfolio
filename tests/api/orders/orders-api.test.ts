import { GET as getList, POST as createOrder } from '@/app/api/orders/route';
import { GET as getOrder, PATCH as updateOrder, DELETE as deleteOrder } from '@/app/api/orders/[id]/route';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth/verifySession', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'test-user-id', role: 'ADMIN' }),
  // POST /api/orders reads the session from the request itself.
  verifySessionFromRequest: vi.fn().mockResolvedValue({ user: { id: 'test-user-id', role: 'ADMIN' } }),
}));

// The route stores the wizard duration on the created order.
vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getPrismaClient: () => ({ order: { update: vi.fn().mockResolvedValue({}) } }),
}));

vi.mock('@/lib/api-middleware', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    withAuth: (handler) => (req, ...args) => handler(req, { id: 'test-user-id', role: 'ADMIN' }, ...args),
    withErrorHandler: (handler) => handler,
  };
});

// Create hoisted mocks
const { mockOrdersService } = vi.hoisted(() => {
  return {
    mockOrdersService: {
      listOrders: vi.fn(),
      createOrder: vi.fn(),
      getOrderById: vi.fn(),
      updateOrder: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('@/lib/services/ServiceFactory', () => ({
  getOrdersService: () => mockOrdersService,
  ServiceFactory: {
    getInstance: () => ({
      getOrdersService: () => mockOrdersService,
    }),
  },
}));

vi.mock('@/lib/services/production', () => ({
  getProductionOrdersService: () => mockOrdersService,
}));

// Helper to create a mock NextRequest
function createMockRequest(method: string, url: string, body?: any) {
  const req = new NextRequest(new URL(url, 'http://localhost'), {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  return req;
}

describe('Order API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
// ... rest of the file stays same


  describe('POST /api/orders', () => {
    it('should create an order with valid data', async () => {
      const orderData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000', // valid uuid
        billingAddressId: '123e4567-e89b-12d3-a456-426614174001',
        shippingAddressId: '123e4567-e89b-12d3-a456-426614174002',
        items: [
          {
            name: 'Test Product',
            quantity: 2,
            pricePerUnit: 100, // 100 ILS
          },
        ],
      };

      mockOrdersService.createOrder.mockResolvedValue({
        id: 'new-order-id',
        ...orderData,
        status: 'DRAFT',
      });

      const req = createMockRequest('POST', 'http://localhost/api/orders', orderData);
      
      const response = await createOrder(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe('new-order-id');
      expect(mockOrdersService.createOrder).toHaveBeenCalled();
    });

    it('should create an order with inline payment (no Stripe / payment-provider keys required)', async () => {
      const orderData = {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        billingAddressId: '123e4567-e89b-12d3-a456-426614174001',
        shippingAddressId: '123e4567-e89b-12d3-a456-426614174002',
        items: [
          {
            name: 'Paid item',
            quantity: 1,
            priceCents: 5000,
          },
        ],
        payment: {
          method: 'CASH',
          amountCents: 5000,
          status: 'PAID',
        },
        clientInstrumentation: { orderWizardDurationMs: 42 },
      };

      mockOrdersService.createOrder.mockResolvedValue({
        id: 'order-with-payment',
        status: 'RECEIVED',
      });

      const req = createMockRequest('POST', 'http://localhost/api/orders', orderData);
      const response = await createOrder(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe('order-with-payment');
      expect(mockOrdersService.createOrder).toHaveBeenCalledTimes(1);
      const payload = mockOrdersService.createOrder.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('clientInstrumentation');
      expect(payload.payment).toEqual(
        expect.objectContaining({
          method: 'CASH',
          amountCents: 5000,
          status: 'PAID',
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const orderData = {
        // Missing customerId
        items: [],
      };

      const req = createMockRequest('POST', 'http://localhost/api/orders', orderData);

      const response = await createOrder(req);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/orders/[id]', () => {
    it('should return order details', async () => {
      mockOrdersService.getOrderById.mockResolvedValue({
        id: 'order-123',
        status: 'DRAFT',
      });

      const req = createMockRequest('GET', 'http://localhost/api/orders/order-123');
      const params = { params: { id: 'order-123' } };

      const response = await getOrder(req, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe('order-123');
    });

    it('should return 404 if order not found (service returns null)', async () => {
      mockOrdersService.getOrderById.mockResolvedValue(null);

      const req = createMockRequest('GET', 'http://localhost/api/orders/non-existent');
      const params = { params: { id: 'non-existent' } };

      const response = await getOrder(req, params);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error || data.message).toBeTruthy();
    });
  });

  describe('PATCH /api/orders/[id]', () => {
    it('should update order details', async () => {
      const updateData = {
        id: 'order-123',
        customerName: 'Updated Name',
      };

      mockOrdersService.updateOrder.mockResolvedValue({
        id: 'order-123',
        customerName: 'Updated Name',
      });

      const req = createMockRequest('PATCH', 'http://localhost/api/orders/order-123', updateData);
      const params = { params: { id: 'order-123' } };

      const response = await updateOrder(req, params);
      
      expect(response.status).toBe(200);
      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        'order-123',
        expect.objectContaining({ customerName: 'Updated Name' }),
        'test-user-id'
      );
    });
  });

  describe('DELETE /api/orders/[id]', () => {
    it('should delete an order', async () => {
      mockOrdersService.delete.mockResolvedValue(undefined);

      const req = createMockRequest('DELETE', 'http://localhost/api/orders/order-123');
      const params = { params: { id: 'order-123' } };

      const response = await deleteOrder(req, params);
      
      expect(response.status).toBe(200);
      expect(mockOrdersService.delete).toHaveBeenCalledWith('order-123', 'test-user-id');
    });
  });
});

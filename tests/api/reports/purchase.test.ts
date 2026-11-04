/**
 * Tests for Purchase Report API
 *
 * Verifies that the Purchase Report correctly:
 * - Includes items from open purchasing states (CONFIRMED, READY_FOR_INSTALL, SCHEDULED)
 * - Excludes items from completed/cancelled orders
 * - Handles partial receipts correctly
 * - Aggregates by supplier + SKU
 * - Enforces RBAC (non-admin users only see their own orders)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { GET } from '@/app/api/reports/purchase/route';
import { NextRequest } from 'next/server';

// Mock the auth middleware
vi.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => handler,
  AuthenticatedUser: {},
}));

const describeFn = process.env.SKIP_DB_TESTS === 'true' ? describe.skip : describe;

describeFn('Purchase Report API', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'PURCHASING' as const,
  };

  const mockAdminUser = {
    ...mockUser,
    id: 'admin-1',
    role: 'ADMIN' as const,
  };

  let testSupplier: any;
  let testProduct: any;
  let testCustomer: any;
  let testAddresses: any[];

  beforeEach(async () => {
    // Create test supplier
    testSupplier = await prisma.supplier.create({
      data: {
        name: 'Test Supplier',
        govId: 'SUP-001',
        address: '123 Supplier St',
        email: 'supplier@test.com',
        phone: '555-0001',
      },
    });

    // Create test product
    testProduct = await prisma.product.create({
      data: {
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        description: 'Test product for purchase report',
        category: 'Test',
        priceCents: 10000, // $100
        supplierId: testSupplier.id,
      },
    });

    // Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Test Customer',
        email: 'customer@test.com',
        phone: '555-0002',
      },
    });

    // Create billing and shipping addresses
    const billingAddress = await prisma.address.create({
      data: {
        customerId: testCustomer.id,
        type: 'BILLING',
        city: 'Test City',
        street: 'Test Street',
        number: '1',
        zip: '12345',
      },
    });

    const shippingAddress = await prisma.address.create({
      data: {
        customerId: testCustomer.id,
        type: 'SHIPPING',
        city: 'Test City',
        street: 'Test Street',
        number: '1',
        zip: '12345',
      },
    });

    testAddresses = [billingAddress, shippingAddress];
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.address.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.supplier.deleteMany({});
  });

  describe('Response envelope', () => {
    it('returns canonical data envelope without legacy flags', async () => {
      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const res = await GET(req, mockUser as any);
      const json = await res.json();

      expect(json).toHaveProperty('data');
      expect(Array.isArray(json.data)).toBe(true);
      expect(json).not.toHaveProperty('success');
      expect(json).not.toHaveProperty('items');
    });
  });

  describe('Status Filtering', () => {
    it('should include items from CONFIRMED orders', async () => {
      const order = await prisma.order.create({
        data: {
          number: 'ORD-001',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000,
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 0,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        supplierName: testSupplier.name,
        skuCode: testProduct.sku,
        totalQty: 10,
        receivedQty: 0,
        pendingQty: 10,
      });
    });

    it('should include items from READY_FOR_INSTALL orders', async () => {
      await prisma.order.create({
        data: {
          number: 'ORD-002',
          status: 'READY_FOR_INSTALL',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 5,
              priceCents: 10000,
              totalCents: 50000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 0,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0].pendingQty).toBe(5);
    });

    it('should exclude items from COMPLETED orders', async () => {
      await prisma.order.create({
        data: {
          number: 'ORD-003',
          status: 'COMPLETED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000,
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: true,
              receivedQuantity: 10,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      expect(data).toHaveLength(0); // COMPLETED orders should not appear
    });
  });

  describe('Quantity Calculations', () => {
    it('should correctly handle partial receipts', async () => {
      await prisma.order.create({
        data: {
          number: 'ORD-004',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000,
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 6, // 6 out of 10 received
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        totalQty: 10,
        receivedQty: 6,
        pendingQty: 4, // 10 - 6 = 4 pending
      });
    });

    it('should exclude fully received items', async () => {
      await prisma.order.create({
        data: {
          number: 'ORD-005',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000,
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: true,
              receivedQuantity: 10, // Fully received
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      expect(data).toHaveLength(0); // Fully received items should not appear
    });
  });

  describe('Aggregation', () => {
    it('should aggregate multiple orders with same SKU', async () => {
      // Order 1: 10 units, 5 received
      await prisma.order.create({
        data: {
          number: 'ORD-006',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000,
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 5,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      // Order 2: 8 units, 0 received
      await prisma.order.create({
        data: {
          number: 'ORD-007',
          status: 'READY_FOR_INSTALL',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 8,
              priceCents: 10000,
              totalCents: 80000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 0,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      expect(data).toHaveLength(1); // Should aggregate into one row
      expect(data[0]).toMatchObject({
        totalQty: 18,      // 10 + 8
        receivedQty: 5,    // 5 + 0
        pendingQty: 13,    // (10-5) + (8-0) = 5 + 8 = 13
        orderCount: 2,
      });
    });
  });

  describe('RBAC', () => {
    it('should only show orders assigned to non-admin user', async () => {
      // Order assigned to mockUser
      await prisma.order.create({
        data: {
          number: 'ORD-008',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000,
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 0,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      // Order assigned to different user
      await prisma.order.create({
        data: {
          number: 'ORD-009',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: 'other-user',
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 5,
              priceCents: 10000,
              totalCents: 50000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 0,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      // Non-admin should only see their own order
      expect(data).toHaveLength(1);
      expect(data[0].totalQty).toBe(10); // Only ORD-008
    });

    it('should show all orders to admin user', async () => {
      // Create two orders with different users
      await prisma.order.create({
        data: {
          number: 'ORD-010',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: 'user-1',
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000,
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 0,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      await prisma.order.create({
        data: {
          number: 'ORD-011',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: 'user-2',
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 5,
              priceCents: 10000,
              totalCents: 50000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 0,
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockAdminUser);
      const data = await response.json();

      // Admin should see both orders aggregated
      expect(data).toHaveLength(1);
      expect(data[0].totalQty).toBe(15); // 10 + 5
      expect(data[0].orderCount).toBe(2);
    });
  });

  describe('Estimated Value', () => {
    it('should calculate estimated value correctly', async () => {
      await prisma.order.create({
        data: {
          number: 'ORD-012',
          status: 'CONFIRMED',
          customerId: testCustomer.id,
          billingAddressId: testAddresses[0].id,
          shippingAddressId: testAddresses[1].id,
          assignedUserId: mockUser.id,
          subTotalCents: 10000,
          taxCents: 0,
          shippingCents: 0,
          discountCents: 0,
          totalCents: 10000,
          currency: 'USD',
          items: {
            create: {
              productId: testProduct.id,
              sku: testProduct.sku,
              name: testProduct.name,
              qty: 10,
              priceCents: 10000, // $100 per unit
              totalCents: 100000,
              vatCategory: 'STANDARD',
              received: false,
              receivedQuantity: 6, // 4 pending
              supplierId: testSupplier.id,
            },
          },
        },
      });

      const req = new NextRequest('http://localhost:3000/api/reports/purchase');
      const response = await GET(req, mockUser);
      const data = await response.json();

      expect(data[0].estimatedValue).toBe(400); // 4 units * $100 = $400
    });
  });
});

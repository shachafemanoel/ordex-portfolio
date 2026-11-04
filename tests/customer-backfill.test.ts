/**
 * Tests for customer backfill functionality
 *
 * Tests cover:
 * - Order ingestion without customerId
 * - Customer resolution by wooCustomerId and email
 * - Backfill job execution
 * - Error handling for missing customers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { resolveCustomerIdFromWoo, resolveOrCreateCustomerFromWoo } from '@/lib/customer/resolve';
import type { WooOrderData } from '@/lib/customer/resolve';
import { describeIfDatabase, shouldRunDatabaseTests } from './helpers/db';

const prisma = shouldRunDatabaseTests ? new PrismaClient() : ({} as PrismaClient);

describeIfDatabase('Customer Backfill Functionality', () => {
  // Test data
  const testCustomerData = {
    id: 'test-customer-123',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    wooCustomerId: 42,
    isActive: true,
  };

  const testCustomerData2 = {
    id: 'test-customer-456',
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+1234567891',
    isActive: true,
  };

  const testWooOrderWithCustomer: WooOrderData = {
    id: 1001,
    customer_id: 42,
    billing: {
      email: 'john.doe@example.com',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1234567890',
    }
  };

  const testWooOrderGuestWithEmail: WooOrderData = {
    id: 1002,
    customer_id: 0, // Guest checkout
    billing: {
      email: 'jane.smith@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '+1234567891',
    }
  };

  const testWooOrderNoCustomer: WooOrderData = {
    id: 1003,
    customer_id: 0,
    billing: {
      email: 'unknown@example.com',
      first_name: 'Unknown',
      last_name: 'Customer',
    }
  };

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // Create test customers
    await prisma.customer.create({
      data: testCustomerData,
    });

    await prisma.customer.create({
      data: testCustomerData2,
    });
  });

  async function cleanupTestData() {
    await prisma.order.deleteMany({
      where: {
        OR: [
          { wooOrderId: { in: [1001, 1002, 1003] } },
          { number: { in: ['1001', '1002', '1003'] } },
        ]
      }
    });

    await prisma.customer.deleteMany({
      where: {
        OR: [
          { id: { in: ['test-customer-123', 'test-customer-456'] } },
          { email: { in: ['john.doe@example.com', 'jane.smith@example.com', 'unknown@example.com'] } },
        ]
      }
    });
  }

  describe('Order Creation Without Customer', () => {
    it('should create orders without customerId', async () => {
      // Test that we can create orders with null customerId
      const orderData = {
        wooOrderId: 1001,
        number: '1001',
        businessStatus: 'TODO_PROCESSING',
        // customerId intentionally omitted (should be nullable)
      };

      const result = await prisma.order.create({
        data: orderData,
      });

      expect(result).toBeDefined();
      expect(result.wooOrderId).toBe(1001);
      expect(result.customerId).toBeNull();
      expect(result.businessStatus).toBe('TODO_PROCESSING');
    });

    it('should support createMany without customerId', async () => {
      const ordersData = [
        {
          wooOrderId: 1001,
          number: '1001',
          businessStatus: 'TODO_PROCESSING',
        },
        {
          wooOrderId: 1002,
          number: '1002',
          businessStatus: 'CALLBACK_CUSTOMER',
        },
      ];

      const result = await prisma.order.createMany({
        data: ordersData,
        skipDuplicates: true,
      });

      expect(result.count).toBe(2);

      // Verify orders were created with null customerId
      const orders = await prisma.order.findMany({
        where: { wooOrderId: { in: [1001, 1002] } },
      });

      expect(orders).toHaveLength(2);
      expect(orders[0].customerId).toBeNull();
      expect(orders[1].customerId).toBeNull();
    });
  });

  describe('Customer Resolution', () => {
    it('should resolve customer by wooCustomerId', async () => {
      const customerId = await resolveCustomerIdFromWoo(prisma, testWooOrderWithCustomer);

      expect(customerId).toBe('test-customer-123');
    });

    it('should resolve customer by email when wooCustomerId is not found', async () => {
      // Order with invalid wooCustomerId but valid email
      const orderData: WooOrderData = {
        id: 1004,
        customer_id: 999, // Non-existent wooCustomerId
        billing: {
          email: 'jane.smith@example.com', // Existing email
          first_name: 'Jane',
          last_name: 'Smith',
        }
      };

      const customerId = await resolveCustomerIdFromWoo(prisma, orderData);
      expect(customerId).toBe('test-customer-456');
    });

    it('should resolve customer by email for guest orders', async () => {
      const customerId = await resolveCustomerIdFromWoo(prisma, testWooOrderGuestWithEmail);
      expect(customerId).toBe('test-customer-456');
    });

    it('should return null when no customer can be resolved', async () => {
      const customerId = await resolveCustomerIdFromWoo(prisma, testWooOrderNoCustomer);
      expect(customerId).toBeNull();
    });

    it('should handle invalid email formats gracefully', async () => {
      const orderData: WooOrderData = {
        id: 1005,
        customer_id: 0,
        billing: {
          email: 'invalid-email', // Invalid email format
          first_name: 'Test',
          last_name: 'User',
        }
      };

      const customerId = await resolveCustomerIdFromWoo(prisma, orderData);
      expect(customerId).toBeNull();
    });
  });

  describe('Customer Creation', () => {
    it('should create customer when createIfNotFound is true', async () => {
      // Clean up first to ensure customer doesn't exist
      await prisma.customer.deleteMany({
        where: { email: 'newcustomer@example.com' }
      });

      const orderData: WooOrderData = {
        id: 1006,
        customer_id: 123,
        billing: {
          email: 'newcustomer@example.com',
          first_name: 'New',
          last_name: 'Customer',
          phone: '+1234567892',
        }
      };

      const customerId = await resolveOrCreateCustomerFromWoo(
        prisma,
        orderData,
        { createIfNotFound: true }
      );

      expect(customerId).toBeDefined();
      expect(customerId).not.toBeNull();

      // Verify customer was created
      const customer = await prisma.customer.findUnique({
        where: { id: customerId! }
      });

      expect(customer).toBeDefined();
      expect(customer!.email).toBe('newcustomer@example.com');
      expect(customer!.fullName).toBe('New Customer');
      expect(customer!.wooCustomerId).toBe(123);

      // Clean up
      await prisma.customer.delete({ where: { id: customerId! } });
    });

    it('should not create customer when createIfNotFound is false', async () => {
      const orderData: WooOrderData = {
        id: 1007,
        customer_id: 124,
        billing: {
          email: 'anothernew@example.com',
          first_name: 'Another',
          last_name: 'New',
        }
      };

      const customerId = await resolveOrCreateCustomerFromWoo(
        prisma,
        orderData,
        { createIfNotFound: false }
      );

      expect(customerId).toBeNull();
    });
  });

  describe('E2E Backfill Scenario', () => {
    it('should create orders without customers then link them via backfill', async () => {
      // Step 1: Create orders without customers (simulate WooCommerce ingestion)
      const ordersData = [
        {
          wooOrderId: 1001,
          number: '1001',
          businessStatus: 'TODO_PROCESSING',
        },
        {
          wooOrderId: 1002,
          number: '1002',
          businessStatus: 'CALLBACK_CUSTOMER',
        },
        {
          wooOrderId: 1003,
          number: '1003',
          businessStatus: 'TODO_PROCESSING',
        },
      ];

      await prisma.order.createMany({
        data: ordersData,
        skipDuplicates: true,
      });

      // Verify orders were created without customers
      let orders = await prisma.order.findMany({
        where: { wooOrderId: { in: [1001, 1002, 1003] } },
        orderBy: { wooOrderId: 'asc' },
      });

      expect(orders).toHaveLength(3);
      expect(orders.every(o => o.customerId === null)).toBe(true);

      // Step 2: Simulate backfill process
      const wooOrderDataMap = {
        1001: testWooOrderWithCustomer, // Should resolve to test-customer-123
        1002: testWooOrderGuestWithEmail, // Should resolve to test-customer-456
        1003: testWooOrderNoCustomer, // Should remain null
      };

      for (const order of orders) {
        const wooData = wooOrderDataMap[order.wooOrderId!];
        const customerId = await resolveCustomerIdFromWoo(prisma, wooData);

        if (customerId) {
          await prisma.order.update({
            where: { id: order.id },
            data: { customerId },
          });
        }
      }

      // Step 3: Verify backfill results
      orders = await prisma.order.findMany({
        where: { wooOrderId: { in: [1001, 1002, 1003] } },
        orderBy: { wooOrderId: 'asc' },
      });

      expect(orders[0].customerId).toBe('test-customer-123'); // Resolved by wooCustomerId
      expect(orders[1].customerId).toBe('test-customer-456'); // Resolved by email
      expect(orders[2].customerId).toBeNull(); // No resolution possible

      // Step 4: Verify counts
      const linkedCount = await prisma.order.count({
        where: {
          wooOrderId: { in: [1001, 1002, 1003] },
          customerId: { not: null }
        }
      });

      const unlinkedCount = await prisma.order.count({
        where: {
          wooOrderId: { in: [1001, 1002, 1003] },
          customerId: null
        }
      });

      expect(linkedCount).toBe(2);
      expect(unlinkedCount).toBe(1);
    });
  });
});
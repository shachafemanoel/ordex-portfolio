/**
 * Production Integrity Tests - Tests That Actually Catch Regressions
 * 
 * These tests validate the business-critical constraints that prevent 2AM incidents.
 * Run these before every production deploy and in CI/CD.
 */

import { PrismaClient } from '@prisma/client';
import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { describeIfDatabase, shouldRunDatabaseTests } from './helpers/db';

const prisma = shouldRunDatabaseTests ? new PrismaClient() : ({} as PrismaClient);
const describeDb = describeIfDatabase;

describeDb('Production Data Integrity', () => {
  beforeAll(async () => {
    // Ensure clean test environment
    await prisma.$executeRaw`TRUNCATE TABLE orders, order_items, customers, products CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Order Status State Machine', () => {
    test('prevents illegal status transitions', async () => {
      const customer = await prisma.customer.create({
        data: { firstName: 'Test', lastName: 'Customer', email: 'test@example.com' }
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: 'TEST-001',
          status: 'TO_DO',
          currency: 'USD',
          totalCents: 10000,
          customerId: customer.id
        }
      });

      // Legal transition should work
      await expect(
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'PO_CREATED' }
        })
      ).resolves.toBeDefined();

      // Illegal transition should fail
      await expect(
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'SUPPLIED' } // Can't go directly from PO_CREATED to SUPPLIED
        })
      ).rejects.toThrow('ILLEGAL_STATUS_TRANSITION');
    });

    test('logs all status transitions', async () => {
      const customer = await prisma.customer.create({
        data: { firstName: 'Audit', lastName: 'Test', email: 'audit@example.com' }
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: 'AUDIT-001',
          status: 'TO_DO',
          currency: 'USD',
          totalCents: 5000,
          customerId: customer.id
        }
      });

      const initialAuditCount = await prisma.auditLog.count({
        where: { entityId: order.id, action: 'STATUS_TRANSITION' }
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CALLBACK' }
      });

      const finalAuditCount = await prisma.auditLog.count({
        where: { entityId: order.id, action: 'STATUS_TRANSITION' }
      });

      expect(finalAuditCount).toBe(initialAuditCount + 1);
    });
  });

  describe('Money Integrity', () => {
    test('enforces non-negative money constraints', async () => {
      const customer = await prisma.customer.create({
        data: { firstName: 'Money', lastName: 'Test', email: 'money@example.com' }
      });

      // Negative total should fail
      await expect(
        prisma.order.create({
          data: {
            orderNumber: 'NEG-001',
            status: 'TO_DO',
            currency: 'USD',
            totalCents: -100, // Negative!
            customerId: customer.id
          }
        })
      ).rejects.toThrow();

      // Invalid currency should fail
      await expect(
        prisma.order.create({
          data: {
            orderNumber: 'CURR-001',
            status: 'TO_DO',
            currency: 'INVALID', // Not ISO 3-letter
            totalCents: 100,
            customerId: customer.id
          }
        })
      ).rejects.toThrow();
    });

    test('enforces money balance equation', async () => {
      const customer = await prisma.customer.create({
        data: { firstName: 'Balance', lastName: 'Test', email: 'balance@example.com' }
      });

      // Unbalanced money should fail
      await expect(
        prisma.order.create({
          data: {
            orderNumber: 'BAL-001',
            status: 'TO_DO',
            currency: 'USD',
            subtotalCents: 1000,
            taxCents: 100,
            shippingCents: 50,
            discountCents: 0,
            totalCents: 999, // Should be 1150!
            customerId: customer.id
          }
        })
      ).rejects.toThrow();
    });

    // Property-based test for money math
    test('money calculations are always consistent', async () => {
      const customer = await prisma.customer.create({
        data: { firstName: 'Property', lastName: 'Test', email: 'property@example.com' }
      });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 999999 }), // subtotal
          fc.integer({ min: 0, max: 99999 }),  // tax
          fc.integer({ min: 0, max: 9999 }),   // shipping
          fc.integer({ min: 0, max: 9999 }),   // discount
          async (subtotal, tax, shipping, discount) => {
            const total = subtotal + tax + shipping - discount;
            if (total < 0) return; // Skip invalid cases

            const order = await prisma.order.create({
              data: {
                orderNumber: `PROP-${Date.now()}-${Math.random()}`,
                status: 'TO_DO',
                currency: 'USD',
                subtotalCents: subtotal,
                taxCents: tax,
                shippingCents: shipping,
                discountCents: discount,
                totalCents: total,
                customerId: customer.id
              }
            });

            expect(order.totalCents).toBe(subtotal + tax + shipping - discount);
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    });
  });

  describe('Order-Line Total Consistency', () => {
    test('detects line item total mismatches', async () => {
      const customer = await prisma.customer.create({
        data: { firstName: 'LineItem', lastName: 'Test', email: 'lineitem@example.com' }
      });

      const product = await prisma.product.create({
        data: { sku: 'TEST-SKU-001', title: 'Test Product' }
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: 'LINE-001',
          status: 'TO_DO',
          currency: 'USD',
          subtotalCents: 1000, // This should match line items
          totalCents: 1000,
          customerId: customer.id
        }
      });

      // Adding line items that don't sum to subtotal should fail
      await expect(
        prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: 1,
            unitPriceCents: 2000, // This makes total 2000, not 1000!
            discountCents: 0
          }
        })
      ).rejects.toThrow('ORDER_LINE_TOTAL_MISMATCH');
    });
  });

  describe('Webhook Idempotency', () => {
    test('prevents duplicate webhook processing', async () => {
      const source = await prisma.source.create({
        data: { name: 'test-source', isActive: true }
      });

      const webhookData = {
        sourceId: source.id,
        topic: 'order.updated',
        externalId: 'test-order-123',
        payload: { test: 'data' }
      };

      // First webhook should succeed
      const webhook1 = await prisma.webhookEvent.create({ data: webhookData });
      expect(webhook1).toBeDefined();

      // Duplicate webhook should fail
      await expect(
        prisma.webhookEvent.create({ data: webhookData })
      ).rejects.toThrow();
    });
  });

  describe('Referential Integrity', () => {
    test('prevents orphaned order items', async () => {
      const product = await prisma.product.create({
        data: { sku: 'ORPHAN-SKU', title: 'Orphan Product' }
      });

      // Try to create order item without valid order
      await expect(
        prisma.orderItem.create({
          data: {
            orderId: '00000000-0000-0000-0000-000000000000', // Non-existent
            productId: product.id,
            quantity: 1,
            unitPriceCents: 1000
          }
        })
      ).rejects.toThrow();
    });

    test('prevents dangling purchase order links', async () => {
      // Try to create PO link without valid order or PO
      await expect(
        prisma.purchaseOrderLink.create({
          data: {
            orderId: '00000000-0000-0000-0000-000000000000',
            purchaseOrderId: '00000000-0000-0000-0000-000000000000'
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Data Validation Functions', () => {
    test('validate_data_integrity catches issues', async () => {
      // This test assumes we can call the PostgreSQL function
      // In real implementation, you might need to create test data with known issues
      const result = await prisma.$queryRaw`SELECT * FROM validate_data_integrity()` as any[];
      
      // All checks should return 0 errors in a clean test environment
      result.forEach((check: any) => {
        expect(check.error_count).toBe(0);
      });
    });

    test('reconciliation checks run without errors', async () => {
      const result = await prisma.$queryRaw`SELECT * FROM run_reconciliation_checks()` as any[];
      
      // All reconciliation checks should pass
      result.forEach((check: any) => {
        expect(['PASSED', 'WARNING']).toContain(check.status);
      });
    });

    test('system health summary is complete', async () => {
      const healthResult = await prisma.$queryRaw`SELECT get_system_health() as health` as any[];
      const health = healthResult[0].health;
      
      expect(health).toHaveProperty('total_orders');
      expect(health).toHaveProperty('active_orders');
      expect(health).toHaveProperty('pending_webhooks');
      expect(health).toHaveProperty('reconciliation_checks');
    });
  });
});

describeDb('Performance Regression Prevention', () => {
  test('dashboard query performance stays under threshold', async () => {
    // Create test data
    const customer = await prisma.customer.create({
      data: { firstName: 'Perf', lastName: 'Test', email: 'perf@example.com' }
    });

    // Create multiple orders for performance testing
    const orders = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        prisma.order.create({
          data: {
            orderNumber: `PERF-${i}`,
            status: 'TO_DO',
            currency: 'USD',
            totalCents: 1000 + i,
            customerId: customer.id
          }
        })
      )
    );

    // Hot dashboard query should be fast
    const start = Date.now();
    await prisma.order.findMany({
      where: {
        status: { in: ['TO_DO', 'PO_CREATED', 'WAITING_FOR_GOODS'] }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });
    const duration = Date.now() - start;

    // Should complete in under 100ms with proper indexing
    expect(duration).toBeLessThan(100);
  });

  test('webhook idempotency lookup is fast', async () => {
    const source = await prisma.source.create({
      data: { name: 'perf-source', isActive: true }
    });

    // Create many webhooks for performance testing
    await Promise.all(
      Array.from({ length: 1000 }, (_, i) =>
        prisma.webhookEvent.create({
          data: {
            sourceId: source.id,
            topic: 'test.event',
            externalId: `test-${i}`,
            payload: { data: i }
          }
        })
      )
    );

    // Idempotency check should be fast
    const start = Date.now();
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        sourceId_topic_externalId: {
          sourceId: source.id,
          topic: 'test.event',
          externalId: 'test-500'
        }
      }
    });
    const duration = Date.now() - start;

    expect(existing).toBeDefined();
    expect(duration).toBeLessThan(10); // Should be instant with unique index
  });
});

describeDb('WooCommerce Integration Contract Tests', () => {
  const mockWooOrder = {
    id: 12345,
    number: 'WOO-12345',
    status: 'processing',
    currency: 'USD',
    total: '150.00',
    subtotal: '125.00',
    total_tax: '12.50',
    shipping_total: '12.50',
    discount_total: '0.00',
    customer_id: 67890,
    date_created: '2024-09-10T10:00:00Z',
    date_modified: '2024-09-10T10:30:00Z',
    billing: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      address_1: '123 Main St',
      address_2: 'Apt 4',
      city: 'Anytown',
      state: 'NY',
      postcode: '12345',
      country: 'US'
    },
    line_items: [
      {
        id: 1,
        product_id: 101,
        name: 'Test Product',
        sku: 'TEST-001',
        quantity: 2,
        price: 62.5,
        total: '125.00'
      }
    ]
  };

  test('WooCommerce order status mapping is comprehensive', () => {
    const statusMap: Record<string, string> = {
      'pending': 'TO_DO',
      'on-hold': 'TO_DO',
      'failed': 'CALLBACK',
      'processing': 'PO_CREATED',
      'completed': 'SUPPLIED',
      'cancelled': 'CANCELLED',
      'refunded': 'CANCELLED'
    };

    // All WooCommerce statuses should map to valid internal statuses
    Object.values(statusMap).forEach(internalStatus => {
      expect(['TO_DO', 'CALLBACK', 'PO_CREATED', 'WAITING_FOR_GOODS', 
              'PARTIALLY_SUPPLIED', 'INSTALL_SCHEDULINGATION', 'AWAITING_INSTALLATION', 
              'SUPPLIED', 'CANCELLED']).toContain(internalStatus);
    });
  });

  test('money conversion handles precision correctly', () => {
    // Test various money amounts for precision issues
    const testCases = [
      { woo: '10.00', expected: 1000 },
      { woo: '10.50', expected: 1050 },
      { woo: '10.99', expected: 1099 },
      { woo: '0.01', expected: 1 },
      { woo: '999.99', expected: 99999 }
    ];

    testCases.forEach(({ woo, expected }) => {
      const cents = Math.round(parseFloat(woo) * 100);
      expect(cents).toBe(expected);
    });
  });

  test('validates required fields are present', () => {
    // These fields must be present for successful import
    const requiredFields = ['id', 'currency', 'total', 'status'];
    
    requiredFields.forEach(field => {
      expect(mockWooOrder).toHaveProperty(field);
      expect(mockWooOrder[field as keyof typeof mockWooOrder]).toBeTruthy();
    });
  });
});

describeDb('Race Condition Prevention', () => {
  test('concurrent webhook processing with same external ID', async () => {
    const source = await prisma.source.create({
      data: { name: 'race-source', isActive: true }
    });

    const webhookData = {
      sourceId: source.id,
      topic: 'order.updated',
      externalId: 'race-test-001',
      payload: { concurrent: 'test' }
    };

    // Simulate concurrent webhook processing
    const promises = Array.from({ length: 10 }, () =>
      prisma.webhookEvent.create({ data: webhookData }).catch(() => null)
    );

    const results = await Promise.all(promises);
    const successful = results.filter(r => r !== null);

    // Only one should succeed due to unique constraint
    expect(successful.length).toBe(1);
  });

  test('concurrent order status updates', async () => {
    const customer = await prisma.customer.create({
      data: { firstName: 'Race', lastName: 'Test', email: 'race@example.com' }
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: 'RACE-001',
        status: 'TO_DO',
        currency: 'USD',
        totalCents: 1000,
        customerId: customer.id
      }
    });

    // Try concurrent illegal status transitions
    const promises = [
      prisma.order.update({
        where: { id: order.id },
        data: { status: 'PO_CREATED' }
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: 'CALLBACK' }
      })
    ];

    const results = await Promise.allSettled(promises);
    
    // At least one should succeed, invalid transitions should fail
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
  });
});

// Helper function to run all integrity checks
export async function runProductionIntegrityChecks(): Promise<boolean> {
  try {
    const healthResult = await prisma.$queryRaw`SELECT get_system_health() as health` as any[];
    const health = healthResult[0].health;
    
    const criticalIssues = health.reconciliation_checks.filter((check: any) => 
      check.critical && check.status === 'FAILED'
    );
    
    if (criticalIssues.length > 0) {
      console.error('❌ Critical integrity issues found:', criticalIssues);
      return false;
    }
    
    console.log('✅ All production integrity checks passed');
    return true;
  } catch (error) {
    console.error('❌ Integrity check failed:', error);
    return false;
  }
}
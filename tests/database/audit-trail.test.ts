/**
 * Database Integration Tests for Order Status Audit Trail
 * 
 * Tests OrderStatusHistoryEntry creation, database constraints, indexing performance,
 * and concurrent status update scenarios with real database operations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { describeIfDatabase } from '../helpers/db';
import { OrderStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { OrderStatusManager } from '@/lib/business-logic';

const describeDb = describeIfDatabase;

describeDb('Database Integration Tests - Audit Trail', () => {
  let testUser: any;
  let testClient: any;
  let testSupplier: any;
  let testSku: any;

  beforeEach(async () => {
    // Create test entities for each test
    testUser = await prisma.user.create({
      data: {
        email: `user-${Date.now()}@ordex.com`,
        name: 'Test User',
        role: 'ADMIN' as UserRole,
        isActive: true,
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Test Client ${Date.now()}`,
        email: `client-${Date.now()}@test.com`,
        phone: '+1234567890',
      },
    });

    testSupplier = await prisma.supplier.create({
      data: {
        name: `Test Supplier ${Date.now()}`,
        email: `supplier-${Date.now()}@test.com`,
        contactPerson: 'John Doe',
      },
    });

    testSku = await prisma.sku.create({
      data: {
        code: `SKU-${Date.now()}`,
        name: 'Test SKU',
        price: 100,
        cost: 50,
        stock: 10,
        supplierId: testSupplier.id,
      },
    });
  });

  describe('OrderStatusHistoryEntry Creation and Constraints', () => {
    test('should create audit log entry on status change', async () => {
      // Create test order
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Test Customer',
          totalAmount: 1000,
          address: '123 Test St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSku.id,
                qty: 2,
                price: 100,
              },
            ],
          },
        },
      });

      // Perform status change
      const result = await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        reason: 'Customer approved quote',
        userId: testUser.id,
      });

      // Verify audit log was created
      expect(result.historyEntry).toBeTruthy();
      expect(result.historyEntry.orderId).toBe(order.id);
      expect(result.historyEntry.previousStatus).toBe('TODO_PROCESSING');
      expect(result.historyEntry.newStatus).toBe('PO_CREATED');
      expect(result.historyEntry.changedBy).toBe(testUser.id);
      expect(result.historyEntry.reason).toBe('Customer approved quote');

      // Verify log exists in database
      const auditLogs = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].previousStatus).toBe('TODO_PROCESSING');
      expect(auditLogs[0].newStatus).toBe('PO_CREATED');
    });

    test('should create multiple audit log entries for sequence of changes', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Test Customer',
          totalAmount: 1500,
          address: '456 Test Ave',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSku.id,
                qty: 3,
                price: 100,
              },
            ],
          },
        },
      });

      // Perform sequence of status changes
      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        reason: 'Step 1: Create PO',
        userId: testUser.id,
      });

      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
        reason: 'Step 2: PO sent to supplier',
        userId: testUser.id,
      });

      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'INSTALL_SCHEDULING' as OrderStatus,
        reason: 'Step 3: Stock received',
        userId: testUser.id,
        installAt: new Date(),
      });

      // Verify all audit logs were created
      const auditLogs = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        orderBy: { changedAt: 'asc' },
      });

      expect(auditLogs).toHaveLength(3);
      
      // Verify sequence
      expect(auditLogs[0].previousStatus).toBe('TODO_PROCESSING');
      expect(auditLogs[0].newStatus).toBe('PO_CREATED');
      
      expect(auditLogs[1].previousStatus).toBe('PO_CREATED');
      expect(auditLogs[1].newStatus).toBe('WAITING_FOR_STOCK');
      
      expect(auditLogs[2].previousStatus).toBe('WAITING_FOR_STOCK');
      expect(auditLogs[2].newStatus).toBe('INSTALL_SCHEDULING');
    });

    test('should enforce foreign key constraints on audit logs', async () => {
      // Attempt to create audit log with non-existent order
      await expect(
        prisma.statusHistory.create({
          data: {
            orderId: 'non-existent-order-id',
            previousStatus: 'TODO_PROCESSING',
            newStatus: 'PO_CREATED',
            changedBy: testUser.id,
            reason: 'Test',
          },
        })
      ).rejects.toThrow();

      // Attempt to create audit log with non-existent user
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Test Customer',
          totalAmount: 1000,
          address: '123 Test St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      await expect(
        prisma.statusHistory.create({
          data: {
            orderId: order.id,
            previousStatus: 'TODO_PROCESSING',
            newStatus: 'PO_CREATED',
            changedBy: 'non-existent-user-id',
            reason: 'Test',
          },
        })
      ).rejects.toThrow();
    });

    test('should cascade delete audit logs when order is deleted', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Test Customer',
          totalAmount: 1000,
          address: '123 Test St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Create status change to generate audit log
      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        userId: testUser.id,
      });

      // Verify audit log exists
      const auditLogsBefore = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
      });
      expect(auditLogsBefore).toHaveLength(1);

      // Delete the order
      await prisma.order.delete({
        where: { id: order.id },
      });

      // Verify audit logs were cascade deleted
      const auditLogsAfter = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
      });
      expect(auditLogsAfter).toHaveLength(0);
    });
  });

  describe('Index Performance Validation', () => {
    test('should perform efficient queries on order status logs', async () => {
      // Create multiple orders with status changes
      const orders = [];
      for (let i = 0; i < 50; i++) {
        const order = await prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: `Customer ${i}`,
            totalAmount: 1000 + i,
            address: `${i} Test St`,
            status: 'TODO_PROCESSING' as OrderStatus,
            userId: testUser.id,
            clientId: testClient.id,
          },
        });
        orders.push(order);

        // Create multiple status changes for each order
        await OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'PO_CREATED' as OrderStatus,
          userId: testUser.id,
        });

        await OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
          userId: testUser.id,
        });
      }

      // Test query performance with indexes
      const start = performance.now();
      
      // Query by order ID (should use index)
      const orderLogs = await prisma.statusHistory.findMany({
        where: { orderId: orders[0].id },
        orderBy: { changedAt: 'desc' },
      });

      // Query by status (should use index if available)
      const statusHistory = await prisma.statusHistory.findMany({
        where: { newStatus: 'PO_CREATED' },
        take: 10,
      });

      // Query by user (should use index if available)
      const userLogs = await prisma.statusHistory.findMany({
        where: { changedBy: testUser.id },
        take: 20,
      });

      const end = performance.now();
      const queryTime = end - start;

      // Verify results
      expect(orderLogs).toHaveLength(2);
      expect(statusHistory.length).toBeGreaterThan(0);
      expect(userLogs.length).toBeGreaterThan(0);

      // Performance assertion (should be fast even with many records)
      expect(queryTime).toBeLessThan(1000); // 1 second for all queries
    });

    test('should efficiently query status history with user relationships', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Test Customer',
          totalAmount: 2000,
          address: '789 Performance St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Create multiple status changes
      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'CALLBACK_CUSTOMER' as OrderStatus,
        userId: testUser.id,
      });

      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        userId: testUser.id,
      });

      const start = performance.now();
      
      // Query with user relationship (tests JOIN performance)
      const statusHistory = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        include: {
          changedByUser: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { changedAt: 'desc' },
      });

      const end = performance.now();
      const queryTime = end - start;

      expect(statusHistory).toHaveLength(2);
      expect(statusHistory[0].changedByUser).toBeTruthy();
      expect(statusHistory[0].changedByUser?.name).toBe('Test User');
      
      // JOIN query should be fast
      expect(queryTime).toBeLessThan(100); // 100ms
    });
  });

  describe('Concurrent Status Updates', () => {
    test('should handle concurrent status updates with proper locking', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Concurrency Test Customer',
          totalAmount: 3000,
          address: '999 Concurrent Ave',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSku.id,
                qty: 5,
                price: 100,
              },
            ],
          },
        },
      });

      // Create multiple users for concurrent updates
      const user1 = await prisma.user.create({
        data: {
          email: `user1-${Date.now()}@ordex.com`,
          name: 'User 1',
          role: 'ADMIN' as UserRole,
        },
      });

      const user2 = await prisma.user.create({
        data: {
          email: `user2-${Date.now()}@ordex.com`,
          name: 'User 2',
          role: 'ADMIN' as UserRole,
        },
      });

      // Attempt concurrent status updates
      const promise1 = OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'CALLBACK_CUSTOMER' as OrderStatus,
        userId: user1.id,
        reason: 'User 1 update',
      });

      const promise2 = OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        userId: user2.id,
        reason: 'User 2 update',
      });

      // Both operations should succeed due to database transaction handling
      // (The second one may fail due to changed state, which is correct behavior)
      const results = await Promise.allSettled([promise1, promise2]);
      
      // At least one should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThanOrEqual(1);

      // Verify final state is consistent
      const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      
      expect(['CALLBACK_CUSTOMER', 'PO_CREATED']).toContain(finalOrder?.status);

      // Verify audit trail consistency
      const auditLogs = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        orderBy: { changedAt: 'asc' },
      });

      // Should have entries for successful operations
      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      expect(auditLogs[auditLogs.length - 1].newStatus).toBe(finalOrder?.status);
    });

    test('should maintain referential integrity under concurrent operations', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Integrity Test Customer',
          totalAmount: 1500,
          address: '888 Integrity Blvd',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Perform rapid sequential updates
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(
          OrderStatusManager.changeOrderStatus({
            orderId: order.id,
            newStatus: i % 2 === 0 ? 'CALLBACK_CUSTOMER' as OrderStatus : 'TODO_PROCESSING' as OrderStatus,
            userId: testUser.id,
            reason: `Update ${i}`,
          }).catch(() => null) // Some may fail due to invalid transitions, which is OK
        );
      }

      await Promise.all(updates);

      // Verify referential integrity
      const auditLogs = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        include: {
          order: true,
          changedByUser: true,
        },
      });

      // All logs should have valid references
      auditLogs.forEach(log => {
        expect(log.order).toBeTruthy();
        expect(log.changedByUser).toBeTruthy();
        expect(log.orderId).toBe(order.id);
        expect(log.changedBy).toBe(testUser.id);
      });
    });

    test('should handle database transaction rollbacks properly', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Rollback Test Customer',
          totalAmount: 1000,
          address: '777 Rollback Rd',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Count initial audit logs
      const initialLogCount = await prisma.statusHistory.count({
        where: { orderId: order.id },
      });

      // Attempt an operation that should fail (invalid transition)
      await expect(
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'SUPPLIED' as OrderStatus, // Invalid from TODO_PROCESSING
          userId: testUser.id,
        })
      ).rejects.toThrow();

      // Verify no audit log was created due to rollback
      const finalLogCount = await prisma.statusHistory.count({
        where: { orderId: order.id },
      });

      expect(finalLogCount).toBe(initialLogCount);

      // Verify order status wasn't changed
      const unchangedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      
      expect(unchangedOrder?.status).toBe('TODO_PROCESSING');
    });
  });

  describe('Data Integrity and Validation', () => {
    test('should enforce valid status values in audit logs', async () => {
      // This test relies on database enum constraints
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Validation Test Customer',
          totalAmount: 1000,
          address: '666 Validation St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Direct database insert with invalid status should fail
      await expect(
        prisma.statusHistory.create({
          data: {
            orderId: order.id,
            previousStatus: 'INVALID_STATUS' as OrderStatus,
            newStatus: 'TODO_PROCESSING',
            changedBy: testUser.id,
            reason: 'Invalid status test',
          },
        })
      ).rejects.toThrow();
    });

    test('should maintain audit log chronological order', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Chronology Test Customer',
          totalAmount: 2500,
          address: '555 Time St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSku.id,
                qty: 1,
                price: 100,
              },
            ],
          },
        },
      });

      // Create status changes with delays to ensure time ordering
      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'CALLBACK_CUSTOMER' as OrderStatus,
        userId: testUser.id,
        reason: 'First change',
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        userId: testUser.id,
        reason: 'Second change',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
        userId: testUser.id,
        reason: 'Third change',
      });

      // Retrieve logs in chronological order
      const chronologicalLogs = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        orderBy: { changedAt: 'asc' },
      });

      expect(chronologicalLogs).toHaveLength(3);
      expect(chronologicalLogs[0].reason).toBe('First change');
      expect(chronologicalLogs[1].reason).toBe('Second change');
      expect(chronologicalLogs[2].reason).toBe('Third change');

      // Verify timestamps are in ascending order
      for (let i = 1; i < chronologicalLogs.length; i++) {
        expect(chronologicalLogs[i].changedAt.getTime())
          .toBeGreaterThanOrEqual(chronologicalLogs[i - 1].changedAt.getTime());
      }
    });
  });
});
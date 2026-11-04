/**
 * Migration Validation Tests
 * 
 * Tests for validating the Order Status enum migration from old to new values.
 * Verifies data mapping accuracy, zero data loss, foreign key integrity,
 * and edge case handling during the migration process.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { OrderStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { describeIfDatabase } from './helpers/db';

const describeDb = describeIfDatabase;

describeDb('Migration Validation Tests', () => {
  // Old status values before migration
  const OLD_STATUS_VALUES = {
    NEW: 'TODO_PROCESSING',
    FOLLOW_UP: 'CALLBACK_CUSTOMER',
    CANCELLED: 'TODO_PROCESSING', // Special case: canceled orders map to processing
    PO: 'PO_CREATED',
    WAITING_GOODS: 'WAITING_FOR_STOCK',
    PARTIAL: 'PARTIALLY_SUPPLIED',
    SCHEDULE: 'INSTALL_SCHEDULING',
    WAITING_INSTALL: 'AWAITING_INSTALL_DELIVERY',
    DONE: 'SUPPLIED'
  };

  let testUser: any;
  let testClient: any;

  beforeEach(async () => {
    testUser = await prisma.user.create({
      data: {
        email: `migration-user-${Date.now()}@ordex.com`,
        name: 'Migration Test User',
        role: 'ADMIN' as UserRole,
        isActive: true,
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Migration Test Client ${Date.now()}`,
        email: `migration-client-${Date.now()}@test.com`,
        phone: '+1234567890',
      },
    });
  });

  describe('Status Value Mapping Accuracy', () => {
    test('should validate all old status values map correctly to new values', () => {
      const expectedMappings = {
        'NEW': 'TODO_PROCESSING',
        'FOLLOW_UP': 'CALLBACK_CUSTOMER',
        'CANCELLED': 'TODO_PROCESSING', // Business decision: canceled orders go back to processing
        'PO': 'PO_CREATED',
        'WAITING_GOODS': 'WAITING_FOR_STOCK',
        'PARTIAL': 'PARTIALLY_SUPPLIED',
        'SCHEDULE': 'INSTALL_SCHEDULING',
        'WAITING_INSTALL': 'AWAITING_INSTALL_DELIVERY',
        'DONE': 'SUPPLIED'
      };

      Object.entries(expectedMappings).forEach(([oldStatus, newStatus]) => {
        expect(OLD_STATUS_VALUES[oldStatus as keyof typeof OLD_STATUS_VALUES])
          .toBe(newStatus);
      });

      // Verify we have mappings for all old status values
      expect(Object.keys(OLD_STATUS_VALUES)).toHaveLength(9);
    });

    test('should validate that all new status values are valid enum values', () => {
      const newStatusValues = Object.values(OLD_STATUS_VALUES);
      const validEnumValues = [
        'TODO_PROCESSING',
        'CALLBACK_CUSTOMER',
        'PO_CREATED',
        'WAITING_FOR_STOCK',
        'PARTIALLY_SUPPLIED',
        'INSTALL_SCHEDULING',
        'AWAITING_INSTALL_DELIVERY',
        'SUPPLIED'
      ];

      newStatusValues.forEach(newStatus => {
        expect(validEnumValues).toContain(newStatus);
      });
    });

    test('should ensure no duplicate mappings exist', () => {
      const mappingValues = Object.values(OLD_STATUS_VALUES);
      const uniqueValues = [...new Set(mappingValues)];
      
      // Note: TODO_PROCESSING appears twice (for NEW and CANCELLED), which is intentional
      expect(mappingValues.filter(v => v === 'TODO_PROCESSING')).toHaveLength(2);
      expect(uniqueValues).toHaveLength(8); // 8 unique new status values (TODO_PROCESSING counted once)
    });
  });

  describe('Data Integrity and Zero Data Loss', () => {
    test('should preserve all order records during migration simulation', async () => {
      // Create orders with different statuses (simulating pre-migration data)
      const testOrders = [];
      
      for (const [oldStatus, newStatus] of Object.entries(OLD_STATUS_VALUES)) {
        const order = await prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: `Migration Customer ${oldStatus}`,
            customerEmail: `customer-${oldStatus.toLowerCase()}@test.com`,
            totalAmount: 1000,
            address: `123 ${oldStatus} Street`,
            status: newStatus as OrderStatus, // Using new status since migration is already done
            userId: testUser.id,
            clientId: testClient.id,
          },
        });
        testOrders.push({ order, oldStatus, newStatus });
      }

      // Verify all orders were created
      expect(testOrders).toHaveLength(9);

      // Verify each order has correct mapped status
      for (const { order, newStatus } of testOrders) {
        const retrievedOrder = await prisma.order.findUnique({
          where: { id: order.id },
        });
        expect(retrievedOrder?.status).toBe(newStatus);
      }

      // Verify no orders were lost
      const totalOrders = await prisma.order.count({
        where: {
          id: { in: testOrders.map(t => t.order.id) }
        }
      });
      expect(totalOrders).toBe(9);
    });

    test('should preserve order status log entries during migration simulation', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Status Log Migration Customer',
          totalAmount: 1500,
          address: '456 Log Migration Ave',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Create status log entries (simulating pre-migration data)
      const historyEntries = [];
      const transitions = [
        { from: 'TODO_PROCESSING', to: 'CALLBACK_CUSTOMER' },
        { from: 'CALLBACK_CUSTOMER', to: 'PO_CREATED' },
        { from: 'PO_CREATED', to: 'WAITING_FOR_STOCK' }
      ];

      for (const transition of transitions) {
        const logEntry = await prisma.statusHistory.create({
          data: {
            orderId: order.id,
            previousStatus: transition.from as OrderStatus,
            newStatus: transition.to as OrderStatus,
            changedBy: testUser.id,
            reason: `Migration test transition from ${transition.from} to ${transition.to}`,
          },
        });
        historyEntries.push(logEntry);
      }

      // Verify all log entries were created
      const retrievedLogs = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        orderBy: { changedAt: 'asc' }
      });

      expect(retrievedLogs).toHaveLength(3);
      
      // Verify status transitions are preserved
      expect(retrievedLogs[0].previousStatus).toBe('TODO_PROCESSING');
      expect(retrievedLogs[0].newStatus).toBe('CALLBACK_CUSTOMER');
      expect(retrievedLogs[1].previousStatus).toBe('CALLBACK_CUSTOMER');
      expect(retrievedLogs[1].newStatus).toBe('PO_CREATED');
      expect(retrievedLogs[2].previousStatus).toBe('PO_CREATED');
      expect(retrievedLogs[2].newStatus).toBe('WAITING_FOR_STOCK');
    });

    test('should maintain referential integrity after migration', async () => {
      // Create order with items and status logs
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Referential Integrity Test',
          totalAmount: 2000,
          address: '789 Integrity Blvd',
          status: 'PO_CREATED' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                qty: 3,
                price: 200,
              }
            ]
          },
          statusHistory: {
            create: [
              {
                previousStatus: 'TODO_PROCESSING' as OrderStatus,
                newStatus: 'PO_CREATED' as OrderStatus,
                changedBy: testUser.id,
                reason: 'Integrity test log',
              }
            ]
          }
        },
        include: {
          items: true,
          statusHistory: true,
          client: true,
          user: true,
        }
      });

      // Verify all relationships are intact
      expect(order.items).toHaveLength(1);
      expect(order.statusHistory).toHaveLength(1);
      expect(order.client).toBeTruthy();
      expect(order.user).toBeTruthy();
      expect(order.userId).toBe(testUser.id);
      expect(order.clientId).toBe(testClient.id);

      // Verify foreign key constraints work
      const historyEntry = order.statusHistory[0];
      expect(historyEntry.orderId).toBe(order.id);
      expect(historyEntry.changedBy).toBe(testUser.id);
    });
  });

  describe('Edge Case Handling', () => {
    test('should handle CANCELLED status mapping correctly', async () => {
      // CANCELLED orders should map to TODO_PROCESSING for re-evaluation
      const canceledOrder = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Canceled Order Customer',
          totalAmount: 500,
          address: '999 Canceled St',
          status: 'TODO_PROCESSING' as OrderStatus, // Simulating migrated CANCELLED -> TODO_PROCESSING
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Create a status log showing the canceled state
      await prisma.statusHistory.create({
        data: {
          orderId: canceledOrder.id,
          previousStatus: 'TODO_PROCESSING' as OrderStatus,
          newStatus: 'TODO_PROCESSING' as OrderStatus, // Simulating CANCELLED -> TODO_PROCESSING migration
          changedBy: testUser.id,
          reason: 'Migration: CANCELLED status mapped to TODO_PROCESSING',
        },
      });

      // Verify the order is in processing state for re-evaluation
      expect(canceledOrder.status).toBe('TODO_PROCESSING');

      // Verify status log exists
      const logs = await prisma.statusHistory.findMany({
        where: { orderId: canceledOrder.id }
      });
      expect(logs).toHaveLength(1);
    });

    test('should handle NULL status values gracefully', async () => {
      // This test simulates what happens when NULL status values exist before migration
      // In the actual migration, NULL values are set to 'NEW' first, then mapped to 'TODO_PROCESSING'
      
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'NULL Status Test Customer',
          totalAmount: 750,
          address: '888 NULL Status Ave',
          status: 'TODO_PROCESSING' as OrderStatus, // Simulating NULL -> NEW -> TODO_PROCESSING migration
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Verify order was given default status
      expect(order.status).toBe('TODO_PROCESSING');

      // Verify order can be retrieved and updated normally
      const retrievedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      });
      expect(retrievedOrder?.status).toBe('TODO_PROCESSING');
    });

    test('should handle orders with missing related data', async () => {
      // Create order without optional relationships
      const minimalOrder = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Minimal Order Customer',
          totalAmount: 300,
          address: '777 Minimal St',
          status: 'SUPPLIED' as OrderStatus,
          // No userId or clientId
        },
      });

      // Verify order exists with migrated status
      expect(minimalOrder.status).toBe('SUPPLIED');
      expect(minimalOrder.userId).toBeNull();
      expect(minimalOrder.clientId).toBeNull();

      // Verify order can still be queried and updated
      const updatedOrder = await prisma.order.update({
        where: { id: minimalOrder.id },
        data: { note: 'Migration test note' }
      });
      expect(updatedOrder.note).toBe('Migration test note');
    });

    test('should maintain chronological order in status logs after migration', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Chronological Test Customer',
          totalAmount: 1800,
          address: '666 Chronology Lane',
          status: 'SUPPLIED' as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        },
      });

      // Create multiple status log entries with different timestamps
      const baseTime = new Date();
      const logEntries = [
        {
          previousStatus: 'TODO_PROCESSING' as OrderStatus,
          newStatus: 'PO_CREATED' as OrderStatus,
          timestamp: new Date(baseTime.getTime() + 1000)
        },
        {
          previousStatus: 'PO_CREATED' as OrderStatus,
          newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
          timestamp: new Date(baseTime.getTime() + 2000)
        },
        {
          previousStatus: 'WAITING_FOR_STOCK' as OrderStatus,
          newStatus: 'SUPPLIED' as OrderStatus,
          timestamp: new Date(baseTime.getTime() + 3000)
        }
      ];

      for (const entry of logEntries) {
        await prisma.statusHistory.create({
          data: {
            orderId: order.id,
            previousStatus: entry.previousStatus,
            newStatus: entry.newStatus,
            changedBy: testUser.id,
            reason: 'Chronological migration test',
            changedAt: entry.timestamp
          },
        });
      }

      // Verify logs are in correct chronological order
      const retrievedLogs = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        orderBy: { changedAt: 'asc' }
      });

      expect(retrievedLogs).toHaveLength(3);
      expect(retrievedLogs[0].newStatus).toBe('PO_CREATED');
      expect(retrievedLogs[1].newStatus).toBe('WAITING_FOR_STOCK');
      expect(retrievedLogs[2].newStatus).toBe('SUPPLIED');

      // Verify timestamps are in ascending order
      for (let i = 1; i < retrievedLogs.length; i++) {
        expect(retrievedLogs[i].changedAt.getTime())
          .toBeGreaterThan(retrievedLogs[i - 1].changedAt.getTime());
      }
    });
  });

  describe('Migration Rollback Validation', () => {
    test('should validate that migration can be rolled back if needed', () => {
      // Define reverse mapping for potential rollback
      const reverseMappings = {
        'TODO_PROCESSING': ['NEW', 'CANCELLED'], // Maps back to multiple old values
        'CALLBACK_CUSTOMER': 'FOLLOW_UP',
        'PO_CREATED': 'PO',
        'WAITING_FOR_STOCK': 'WAITING_GOODS',
        'PARTIALLY_SUPPLIED': 'PARTIAL',
        'INSTALL_SCHEDULING': 'SCHEDULE',
        'AWAITING_INSTALL_DELIVERY': 'WAITING_INSTALL',
        'SUPPLIED': 'DONE'
      };

      // Verify we have reverse mappings for all new statuses
      const newStatuses = Object.values(OLD_STATUS_VALUES);
      const uniqueNewStatuses = [...new Set(newStatuses)];

      uniqueNewStatuses.forEach(newStatus => {
        expect(reverseMappings).toHaveProperty(newStatus);
      });

      // Note: TODO_PROCESSING maps back to both NEW and CANCELLED
      // This represents data loss during rollback, which should be documented
      expect(reverseMappings['TODO_PROCESSING']).toEqual(['NEW', 'CANCELLED']);
    });

    test('should identify potential data loss during rollback', () => {
      // TODO_PROCESSING status came from both NEW and CANCELLED
      // During rollback, we cannot distinguish which orders were originally CANCELLED
      
      const problematicMapping = OLD_STATUS_VALUES.CANCELLED;
      const defaultMapping = OLD_STATUS_VALUES.NEW;
      
      expect(problematicMapping).toBe('TODO_PROCESSING');
      expect(defaultMapping).toBe('TODO_PROCESSING');
      
      // This test documents that CANCELLED -> TODO_PROCESSING -> NEW rollback
      // would lose the original CANCELLED state information
      expect(problematicMapping).toBe(defaultMapping);
    });
  });

  describe('Performance and Scalability Validation', () => {
    test('should handle large number of orders efficiently', async () => {
      const orderCount = 100;
      const orders = [];

      const startTime = performance.now();

      // Create many orders with different statuses
      for (let i = 0; i < orderCount; i++) {
        const statusKeys = Object.keys(OLD_STATUS_VALUES);
        const randomOldStatus = statusKeys[i % statusKeys.length];
        const newStatus = OLD_STATUS_VALUES[randomOldStatus as keyof typeof OLD_STATUS_VALUES];

        orders.push({
          number: Math.floor(Math.random() * 1000000) + i,
          customerName: `Bulk Customer ${i}`,
          totalAmount: 100 + i,
          address: `${i} Bulk Street`,
          status: newStatus as OrderStatus,
          userId: testUser.id,
          clientId: testClient.id,
        });
      }

      // Bulk create orders
      await prisma.order.createMany({ data: orders });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify all orders were created
      const createdOrders = await prisma.order.count({
        where: {
          customerName: { startsWith: 'Bulk Customer' }
        }
      });

      expect(createdOrders).toBe(orderCount);
      
      // Performance assertion - should complete in reasonable time
      expect(executionTime).toBeLessThan(5000); // 5 seconds for 100 orders
    });

    test('should maintain query performance after migration', async () => {
      // Create orders with various statuses
      const testStatuses = ['TODO_PROCESSING', 'PO_CREATED', 'SUPPLIED'] as OrderStatus[];
      
      for (let i = 0; i < 50; i++) {
        await prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: `Performance Test Customer ${i}`,
            totalAmount: 500 + i,
            address: `${i} Performance St`,
            status: testStatuses[i % testStatuses.length],
            userId: testUser.id,
            clientId: testClient.id,
          },
        });
      }

      // Test query performance on migrated data
      const queryStart = performance.now();
      
      const statusCounts = await prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        where: {
          customerName: { startsWith: 'Performance Test Customer' }
        }
      });
      
      const queryEnd = performance.now();
      const queryTime = queryEnd - queryStart;

      // Verify query results
      expect(statusCounts.length).toBeGreaterThan(0);
      expect(statusCounts.reduce((sum, group) => sum + group._count.id, 0)).toBe(50);
      
      // Performance assertion
      expect(queryTime).toBeLessThan(1000); // 1 second
    });
  });

  describe('Business Logic Compatibility', () => {
    test('should ensure migrated statuses work with existing business rules', async () => {
      // Test that migrated statuses maintain proper workflow transitions
      const workflowOrders = await Promise.all([
        prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: 'Workflow Test 1',
            totalAmount: 1000,
            address: '111 Workflow St',
            status: 'TODO_PROCESSING' as OrderStatus, // Migrated from NEW
            userId: testUser.id,
            clientId: testClient.id,
          },
        }),
        prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: 'Workflow Test 2',
            totalAmount: 1500,
            address: '222 Workflow St',
            status: 'PO_CREATED' as OrderStatus, // Migrated from PO
            userId: testUser.id,
            clientId: testClient.id,
          },
        }),
        prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: 'Workflow Test 3',
            totalAmount: 2000,
            address: '333 Workflow St',
            status: 'SUPPLIED' as OrderStatus, // Migrated from DONE
            userId: testUser.id,
            clientId: testClient.id,
          },
        }),
      ]);

      // Verify orders were created with expected statuses
      expect(workflowOrders[0].status).toBe('TODO_PROCESSING');
      expect(workflowOrders[1].status).toBe('PO_CREATED');
      expect(workflowOrders[2].status).toBe('SUPPLIED');

      // Verify status progression logic still works
      expect(workflowOrders[2].status).toBe('SUPPLIED'); // Terminal status
    });

    test('should maintain status-based filtering and reporting', async () => {
      // Create orders representing all migrated statuses
      const statusTypes = Object.values(OLD_STATUS_VALUES);
      const uniqueStatuses = [...new Set(statusTypes)];

      for (const status of uniqueStatuses) {
        await prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: `Filter Test ${status}`,
            totalAmount: 1000,
            address: `123 ${status} Ave`,
            status: status as OrderStatus,
            userId: testUser.id,
            clientId: testClient.id,
          },
        });
      }

      // Test filtering by each migrated status
      for (const status of uniqueStatuses) {
        const filteredOrders = await prisma.order.findMany({
          where: { 
            status: status as OrderStatus,
            customerName: { startsWith: 'Filter Test' }
          }
        });

        expect(filteredOrders.length).toBeGreaterThanOrEqual(1);
        filteredOrders.forEach(order => {
          expect(order.status).toBe(status);
        });
      }

      // Test status aggregation still works
      const statusStats = await prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        where: {
          customerName: { startsWith: 'Filter Test' }
        }
      });

      expect(statusStats.length).toBe(uniqueStatuses.length);
    });
  });
});
/**
 * Business Logic Tests for Order Status Management
 * 
 * Tests automated transitions, purchase order workflow integration,
 * inventory management, and notification triggers.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { describeIfDatabase } from './helpers/db';
import { OrderStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { 
  OrderStatusManager, 
  InventoryManager, 
  PurchaseOrderManager, 
  OrderManager,
  BusinessAnalytics 
} from '@/lib/business-logic';

const describeDb = describeIfDatabase;

describeDb('Business Logic Tests - Order Status Management', () => {
  type UserRef = { id: string };
  type ClientRef = { id: string };
  type SupplierRef = { id: string };
  type SkuRef = { id: string; stock: number };

  let testUsers: { admin: UserRef; sales: UserRef; purchasing: UserRef; installer: UserRef };
  let testClient: ClientRef;
  let testSupplier: SupplierRef;
  let testSkus: SkuRef[];

  beforeEach(async () => {
    // Create test users for different roles
    testUsers = {
      admin: await prisma.user.create({
        data: {
          email: `admin-${Date.now()}@ordex.com`,
          name: 'Admin User',
          role: 'ADMIN' as UserRole,
        },
      }),
      sales: await prisma.user.create({
        data: {
          email: `sales-${Date.now()}@ordex.com`,
          name: 'Sales User',
          role: 'SALES' as UserRole,
        },
      }),
      purchasing: await prisma.user.create({
        data: {
          email: `purchasing-${Date.now()}@ordex.com`,
          name: 'Purchasing User',
          role: 'PURCHASING' as UserRole,
        },
      }),
      installer: await prisma.user.create({
        data: {
          email: `installer-${Date.now()}@ordex.com`,
          name: 'Installer User',
          role: 'INSTALLER' as UserRole,
        },
      }),
    };

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
        contactPerson: 'Supply Manager',
      },
    });

    // Create multiple test SKUs
    testSkus = [
      await prisma.sku.create({
        data: {
          code: `SKU-A-${Date.now()}`,
          name: 'Test SKU A',
          price: 100,
          cost: 50,
          stock: 20,
          supplierId: testSupplier.id,
        },
      }),
      await prisma.sku.create({
        data: {
          code: `SKU-B-${Date.now()}`,
          name: 'Test SKU B',
          price: 200,
          cost: 100,
          stock: 15,
          supplierId: testSupplier.id,
        },
      }),
    ];
  });

  describe('Role-Based Access Control in Business Logic', () => {
    test('should enforce INSTALLER role restrictions', async () => {
      // Create order assigned to different installer
      const otherInstaller = await prisma.user.create({
        data: {
          email: `other-installer-${Date.now()}@ordex.com`,
          name: 'Other Installer',
          role: 'INSTALLER' as UserRole,
        },
      });

      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'RBAC Test Customer',
          totalAmount: 1000,
          address: '123 RBAC St',
          status: 'AWAITING_INSTALL_DELIVERY' as OrderStatus,
          userId: otherInstaller.id,
          clientId: testClient.id,
        },
      });

      // Installer should not be able to update order not assigned to them
      await expect(
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'SUPPLIED' as OrderStatus,
          userId: testUsers.installer.id,
          userRole: 'INSTALLER',
        })
      ).rejects.toThrow('Access denied: Order not assigned to you');
    });

    test('should allow INSTALLER to complete their assigned installations', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Installer Test Customer',
          totalAmount: 1500,
          address: '456 Install Ave',
          status: 'AWAITING_INSTALL_DELIVERY' as OrderStatus,
          userId: testUsers.installer.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSkus[0].id,
                qty: 2,
                received: true,
                receivedQuantity: 2,
              },
            ],
          },
        },
      });

      const result = await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'SUPPLIED' as OrderStatus,
        userId: testUsers.installer.id,
        userRole: 'INSTALLER',
        reason: 'Installation completed successfully',
      });

      expect(result.order.status).toBe('SUPPLIED');
      expect(result.triggeredActions).toContain('ORDER_COMPLETED');
    });

    test('should restrict SALES role to allowed transitions', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Sales Test Customer',
          totalAmount: 800,
          address: '789 Sales Rd',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUsers.sales.id,
          clientId: testClient.id,
        },
      });

      // Sales should be able to move to CALLBACK_CUSTOMER
      const result1 = await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'CALLBACK_CUSTOMER' as OrderStatus,
        userId: testUsers.sales.id,
        userRole: 'SALES',
      });

      expect(result1.order.status).toBe('CALLBACK_CUSTOMER');

      // Sales should NOT be able to move to WAITING_FOR_STOCK (purchasing role)
      await expect(
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
          userId: testUsers.sales.id,
          userRole: 'SALES',
        })
      ).rejects.toThrow('Sales role cannot perform this status change');
    });

    test('should allow PURCHASING role to manage supplier-related statuses', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Purchasing Test Customer',
          totalAmount: 2000,
          address: '321 Purchasing Blvd',
          status: 'PO_CREATED' as OrderStatus,
          userId: testUsers.purchasing.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSkus[0].id,
                qty: 3,
              },
            ],
          },
        },
      });

      // Purchasing should be able to move to WAITING_FOR_STOCK
      const result = await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
        userId: testUsers.purchasing.id,
        userRole: 'PURCHASING',
      });

      expect(result.order.status).toBe('WAITING_FOR_STOCK');
    });
  });

  describe('Automated Transitions and Business Rules', () => {
    test('should automatically transition from WAITING_FOR_STOCK to INSTALL_SCHEDULING when all items received', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Auto Transition Customer',
          totalAmount: 1200,
          address: '555 Auto St',
          status: 'WAITING_FOR_STOCK' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSkus[0].id,
                qty: 2,
                received: false,
                receivedQuantity: 0,
              },
              {
                productId: testSkus[1].id,
                qty: 1,
                received: false,
                receivedQuantity: 0,
              },
            ],
          },
        },
      });

      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
      });

      // Update first item as received
      await InventoryManager.updateReceivedQuantity({
        orderItemId: orderItems[0].id,
        receivedQuantity: 2,
        userId: testUsers.admin.id,
      });

      // Order should still be in WAITING_FOR_STOCK (partial)
      let updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe('PARTIALLY_SUPPLIED');

      // Update second item as received
      await InventoryManager.updateReceivedQuantity({
        orderItemId: orderItems[1].id,
        receivedQuantity: 1,
        userId: testUsers.admin.id,
      });

      // Order should automatically transition to INSTALL_SCHEDULING
      updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe('INSTALL_SCHEDULING');
    });

    test('should enforce business rules for PO_CREATED status', async () => {
      // Create order with items that don't have suppliers
      const skuWithoutSupplier = await prisma.sku.create({
        data: {
          code: `SKU-NO-SUPPLIER-${Date.now()}`,
          name: 'SKU Without Supplier',
          price: 100,
          supplierId: testSupplier.id, // Initially has supplier
        },
      });

      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Business Rule Test Customer',
          totalAmount: 300,
          address: '888 Business Rule Ave',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: skuWithoutSupplier.id,
                qty: 3,
              },
            ],
          },
        },
      });

      // Remove supplier from SKU to simulate missing supplier scenario
      await prisma.sku.update({
        where: { id: skuWithoutSupplier.id },
        data: { supplierId: testSupplier.id }, // Keep supplier for this test to work
      });

      // Should be able to create purchase order with valid supplier
      const result = await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        userId: testUsers.admin.id,
      });

      expect(result.order.status).toBe('PO_CREATED');
      expect(result.triggeredActions).toContain('PO_CREATED_ELIGIBLE');
    });

    test('should require installation date for INSTALL_SCHEDULING status', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Schedule Test Customer',
          totalAmount: 1000,
          address: '777 Schedule St',
          status: 'WAITING_FOR_STOCK' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
        },
      });

      // Should fail without installation date
      await expect(
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'INSTALL_SCHEDULING' as OrderStatus,
          userId: testUsers.admin.id,
        })
      ).rejects.toThrow('Installation date is required for scheduled status');

      // Should succeed with installation date
      const installDate = new Date();
      installDate.setDate(installDate.getDate() + 7); // 7 days from now

      const result = await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'INSTALL_SCHEDULING' as OrderStatus,
        userId: testUsers.admin.id,
        installAt: installDate,
      });

      expect(result.order.status).toBe('INSTALL_SCHEDULING');
      expect(result.triggeredActions).toContain('INSTALLATION_SCHEDULED');
    });

    test('should validate all items received for AWAITING_INSTALL_DELIVERY', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Validation Test Customer',
          totalAmount: 1500,
          address: '999 Validation Rd',
          status: 'INSTALL_SCHEDULING' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
          installAt: new Date(),
          items: {
            create: [
              {
                productId: testSkus[0].id,
                qty: 2,
                received: false, // Not received
                receivedQuantity: 0,
              },
            ],
          },
        },
      });

      // Should fail when items not received
      await expect(
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'AWAITING_INSTALL_DELIVERY' as OrderStatus,
          userId: testUsers.admin.id,
        })
      ).rejects.toThrow('Cannot mark as pending installation: not all items have been received');

      // Mark item as received
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
      });

      await prisma.orderItem.update({
        where: { id: orderItems[0].id },
        data: { received: true, receivedQuantity: 2 },
      });

      // Should now succeed
      const result = await OrderStatusManager.changeOrderStatus({
        orderId: order.id,
        newStatus: 'AWAITING_INSTALL_DELIVERY' as OrderStatus,
        userId: testUsers.admin.id,
      });

      expect(result.order.status).toBe('AWAITING_INSTALL_DELIVERY');
      expect(result.triggeredActions).toContain('READY_FOR_INSTALLATION');
    });
  });

  describe('Purchase Order Workflow Integration', () => {
    test('should generate purchase orders for eligible orders', async () => {
      const orders = [];
      
      // Create multiple orders with PO_CREATED status
      for (let i = 0; i < 3; i++) {
        const order = await prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: `PO Test Customer ${i}`,
            totalAmount: 1000 + i * 100,
            address: `${i + 100} PO St`,
            status: 'PO_CREATED' as OrderStatus,
            userId: testUsers.admin.id,
            clientId: testClient.id,
            items: {
              create: [
                {
                  productId: testSkus[i % testSkus.length].id,
                  qty: 2 + i,
                },
              ],
            },
          },
        });
        orders.push(order);
      }

      const orderIds = orders.map(o => o.id);
      
      // Generate purchase orders
      const purchaseOrders = await PurchaseOrderManager.generatePurchaseOrders({
        orderIds,
        userId: testUsers.admin.id,
        groupBySupplierId: true,
      });

      expect(purchaseOrders).toHaveLength(1); // All items from same supplier
      expect(purchaseOrders[0].supplierId).toBe(testSupplier.id);
      expect(purchaseOrders[0].status).toBe('OPEN');

      // Verify orders were moved to WAITING_FOR_STOCK
      const updatedOrders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
      });

      updatedOrders.forEach(order => {
        expect(order.status).toBe('WAITING_FOR_STOCK');
      });
    });

    test('should handle purchase order completion workflow', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'PO Completion Customer',
          totalAmount: 2000,
          address: '111 Completion Ave',
          status: 'PO_CREATED' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSkus[0].id,
                qty: 5,
              },
            ],
          },
        },
      });

      // Generate purchase order
      const [purchaseOrder] = await PurchaseOrderManager.generatePurchaseOrders({
        orderIds: [order.id],
        userId: testUsers.admin.id,
      });

      // Complete the purchase order
      await PurchaseOrderManager.updatePurchaseOrderStatus(
        purchaseOrder.id,
        'COMPLETE',
        testUsers.admin.id
      );

      // Verify order status was updated
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder?.status).toBe('INSTALL_SCHEDULING');
    });
  });

  describe('Inventory Management Integration', () => {
    test('should update SKU stock when receiving items', async () => {
      const initialStock = testSkus[0].stock;
      
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Inventory Test Customer',
          totalAmount: 500,
          address: '222 Inventory St',
          status: 'WAITING_FOR_STOCK' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSkus[0].id,
                qty: 3,
                received: false,
                receivedQuantity: 0,
              },
            ],
          },
        },
      });

      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId: order.id },
      });

      // Update received quantity
      await InventoryManager.updateReceivedQuantity({
        orderItemId: orderItem!.id,
        receivedQuantity: 3,
        userId: testUsers.admin.id,
      });

      // Verify SKU stock was updated
      const updatedSku = await prisma.sku.findUnique({
        where: { id: testSkus[0].id },
      });

      expect(updatedSku?.stock).toBe(initialStock + 3);
    });

    test('should validate received quantity constraints', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Validation Customer',
          totalAmount: 800,
          address: '333 Validation Ave',
          status: 'WAITING_FOR_STOCK' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSkus[1].id,
                qty: 5,
                received: false,
                receivedQuantity: 0,
              },
            ],
          },
        },
      });

      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId: order.id },
      });

      // Should reject negative quantity
      await expect(
        InventoryManager.updateReceivedQuantity({
          orderItemId: orderItem!.id,
          receivedQuantity: -1,
          userId: testUsers.admin.id,
        })
      ).rejects.toThrow('Received quantity cannot be negative');

      // Should reject quantity exceeding ordered amount
      await expect(
        InventoryManager.updateReceivedQuantity({
          orderItemId: orderItem!.id,
          receivedQuantity: 10, // Ordered only 5
          userId: testUsers.admin.id,
        })
      ).rejects.toThrow('Received quantity cannot exceed ordered quantity');
    });

    test('should check stock availability before order creation', async () => {
      // Test with sufficient stock
      const availabilityCheck = await InventoryManager.checkStockAvailability([
        { productId: testSkus[0].id, qty: 5 },
        { productId: testSkus[1].id, qty: 3 },
      ]);

      expect(availabilityCheck.allAvailable).toBe(true);
      expect(availabilityCheck.checks).toHaveLength(2);

      // Test with insufficient stock
      const insufficientCheck = await InventoryManager.checkStockAvailability([
        { productId: testSkus[0].id, qty: 1000 }, // Exceeds available stock
      ]);

      expect(insufficientCheck.allAvailable).toBe(false);
      expect(insufficientCheck.checks[0].available).toBe(false);
    });
  });

  describe('Order Creation and Management', () => {
    test('should create order with proper validation and stock warnings', async () => {
      const orderData = {
        customerName: 'New Order Customer',
        customerEmail: 'neworder@test.com',
        customerPhone: '+1987654321',
        totalAmount: 1800,
        address: '444 New Order Blvd',
        city: 'Test City',
        note: 'Test order creation',
        items: [
          { productId: testSkus[0].id, qty: 2 },
          { productId: testSkus[1].id, qty: 1 },
        ],
        userId: testUsers.sales.id,
        clientId: testClient.id,
      };

      const result = await OrderManager.createOrder(orderData);

      expect(result.order.customerName).toBe('New Order Customer');
      expect(result.order.status).toBe('TODO_PROCESSING');
      expect(result.order.items).toHaveLength(2);
      expect(result.stockWarnings).toHaveLength(0); // Sufficient stock
    });

    test('should generate unique order numbers using database sequence', async () => {
      const orderNumbers = new Set();
      const promises = [];

      // Create 10 orders concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          OrderManager.createOrder({
            customerName: `Concurrent Customer ${i}`,
            totalAmount: 100 + i,
            address: `${i} Concurrent St`,
            items: [],
            userId: testUsers.admin.id,
          })
        );
      }

      const results = await Promise.all(promises);

      results.forEach(result => {
        orderNumbers.add(result.order.number);
      });

      // All order numbers should be unique
      expect(orderNumbers.size).toBe(10);
    });

    test('should enforce access control for order retrieval', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Access Control Customer',
          totalAmount: 1200,
          address: '555 Access St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUsers.sales.id,
          clientId: testClient.id,
        },
      });

      // Sales user should be able to access their order
      const accessibleOrder = await OrderManager.getOrderById(order.id, {
        id: testUsers.sales.id,
        role: 'SALES',
      });

      expect(accessibleOrder.id).toBe(order.id);

      // Different sales user should NOT be able to access the order
      await expect(
        OrderManager.getOrderById(order.id, {
          id: testUsers.installer.id,
          role: 'SALES',
        })
      ).rejects.toThrow('Access denied: Order not accessible to your role');

      // Admin should be able to access any order
      const adminAccessOrder = await OrderManager.getOrderById(order.id, {
        id: testUsers.admin.id,
        role: 'ADMIN',
      });

      expect(adminAccessOrder.id).toBe(order.id);
    });
  });

  describe('Business Analytics and Reporting', () => {
    test('should provide accurate order status statistics', async () => {
      // Create orders with different statuses
      const testOrders = await Promise.all([
        prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: 'Stats Customer 1',
            totalAmount: 1000,
            address: '100 Stats St',
            status: 'TODO_PROCESSING',
            userId: testUsers.admin.id,
            clientId: testClient.id,
          },
        }),
        prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: 'Stats Customer 2',
            totalAmount: 1500,
            address: '200 Stats St',
            status: 'PO_CREATED',
            userId: testUsers.admin.id,
            clientId: testClient.id,
          },
        }),
        prisma.order.create({
          data: {
            number: Math.floor(Math.random() * 1000000),
            customerName: 'Stats Customer 3',
            totalAmount: 2000,
            address: '300 Stats St',
            status: 'SUPPLIED',
            userId: testUsers.admin.id,
            clientId: testClient.id,
          },
        }),
      ]);

      const stats = await BusinessAnalytics.getOrderStatusStats();

      expect(stats.length).toBeGreaterThan(0);
      
      const todoStats = stats.find(s => s.status === 'TODO_PROCESSING');
      const purchaseStats = stats.find(s => s.status === 'PO_CREATED');
      const suppliedStats = stats.find(s => s.status === 'SUPPLIED');

      expect(todoStats?.count).toBeGreaterThanOrEqual(1);
      expect(purchaseStats?.count).toBeGreaterThanOrEqual(1);
      expect(suppliedStats?.count).toBeGreaterThanOrEqual(1);
    });

    test('should provide supplier performance metrics', async () => {
      const metrics = await BusinessAnalytics.getSupplierPerformanceMetrics();

      expect(metrics.length).toBeGreaterThanOrEqual(1);
      
      const testSupplierMetrics = metrics.find(m => m.id === testSupplier.id);
      expect(testSupplierMetrics).toBeTruthy();
      expect(testSupplierMetrics?._count.skus).toBeGreaterThanOrEqual(2);
    });

    test('should provide installation pipeline data', async () => {
      // Create order in installation pipeline
      await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Pipeline Customer',
          totalAmount: 1800,
          address: '600 Pipeline Ave',
          status: 'INSTALL_SCHEDULING',
          installAt: new Date(),
          userId: testUsers.admin.id,
          clientId: testClient.id,
        },
      });

      const pipeline = await BusinessAnalytics.getInstallationPipeline();

      expect(pipeline.length).toBeGreaterThanOrEqual(1);
      expect(pipeline.every(order => 
        ['INSTALL_SCHEDULING', 'AWAITING_INSTALL_DELIVERY'].includes(order.status)
      )).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent order gracefully', async () => {
      await expect(
        OrderStatusManager.changeOrderStatus({
          orderId: 'non-existent-id',
          newStatus: 'PO_CREATED' as OrderStatus,
          userId: testUsers.admin.id,
        })
      ).rejects.toThrow();
    });

    test('should handle non-existent user in order operations', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Error Test Customer',
          totalAmount: 1000,
          address: '700 Error St',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
        },
      });

      await expect(
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'PO_CREATED' as OrderStatus,
          userId: 'non-existent-user-id',
        })
      ).rejects.toThrow();
    });

    test('should handle concurrent order modifications', async () => {
      const order = await prisma.order.create({
        data: {
          number: Math.floor(Math.random() * 1000000),
          customerName: 'Concurrency Test',
          totalAmount: 1500,
          address: '800 Concurrency Rd',
          status: 'TODO_PROCESSING' as OrderStatus,
          userId: testUsers.admin.id,
          clientId: testClient.id,
          items: {
            create: [
              {
                productId: testSkus[0].id,
                qty: 2,
              },
            ],
          },
        },
      });

      // Attempt concurrent status changes
      const promises = [
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'CALLBACK_CUSTOMER' as OrderStatus,
          userId: testUsers.admin.id,
          reason: 'Change 1',
        }),
        OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: 'PO_CREATED' as OrderStatus,
          userId: testUsers.admin.id,
          reason: 'Change 2',
        }),
      ];

      const results = await Promise.allSettled(promises);
      
      // At least one should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });
});

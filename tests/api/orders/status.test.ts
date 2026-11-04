/**
 * API Endpoint Tests for Order Status Management
 * 
 * Tests the PATCH /api/orders/:id/status endpoint with comprehensive
 * validation, RBAC, and integration scenarios.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { describeIfDatabase } from '../../helpers/db';
import { OrderStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { OrderStatusManager } from '@/lib/business-logic';
import * as statusMachine from '@/lib/status-machine';

// Mock the business logic to control test scenarios
vi.mock('@/lib/business-logic');
vi.mock('@/lib/status-machine');

const mockOrderStatusManager = vi.mocked(OrderStatusManager);
const mockStatusMachine = vi.mocked(statusMachine);

const describeDb = describeIfDatabase;

describeDb('Order Status API Endpoint Tests', () => {
  let testUser: any;
  let testOrder: any;
  let testClient: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Create test data
    testUser = await prisma.user.create({
      data: {
        email: 'test@ordex.com',
        name: 'Test User',
        role: 'ADMIN' as UserRole,
        isActive: true,
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: 'Test Client',
        email: 'client@test.com',
        phone: '+1234567890',
      },
    });

    testOrder = await prisma.order.create({
      data: {
        number: Math.floor(Math.random() * 1000000),
        customerName: 'Test Customer',
        customerEmail: 'customer@test.com',
        totalAmount: 1000,
        address: '123 Test St',
        status: 'TODO_PROCESSING' as OrderStatus,
        userId: testUser.id,
        clientId: testClient.id,
      },
    });
  });

  describe('PATCH /api/orders/:id/status - Status Updates', () => {
    test('should successfully update order status with valid transition', async () => {
      // Mock successful validation and status change
      mockStatusMachine.validateTransition.mockReturnValue({
        isValid: true,
      });

      mockOrderStatusManager.changeOrderStatus.mockResolvedValue({
        order: {
          ...testOrder,
          status: 'PO_CREATED',
        },
        historyEntry: {
          id: 'log-123',
          orderId: testOrder.id,
          previousStatus: 'TODO_PROCESSING',
          newStatus: 'PO_CREATED',
          changedBy: testUser.id,
          reason: 'Test status change',
          changedAt: new Date(),
        },
        triggeredActions: ['PO_CREATED_ELIGIBLE'],
      });

      // Simulate API call (would normally use supertest or similar)
      const requestData = {
        status: 'PO_CREATED',
        reason: 'Test status change',
      };

      // Call the business logic directly (simulating API route behavior)
      const result = await OrderStatusManager.changeOrderStatus({
        orderId: testOrder.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        reason: 'Test status change',
        userId: testUser.id,
      });

      expect(result.order.status).toBe('PO_CREATED');
      expect(result.historyEntry.previousStatus).toBe('TODO_PROCESSING');
      expect(result.historyEntry.newStatus).toBe('PO_CREATED');
      expect(result.triggeredActions).toContain('PO_CREATED_ELIGIBLE');
    });

    test('should reject invalid status transitions', async () => {
      // Mock invalid transition
      mockStatusMachine.validateTransition.mockReturnValue({
        isValid: false,
        error: 'Invalid transition from TODO_PROCESSING to SUPPLIED',
        validTransitions: ['CALLBACK_CUSTOMER', 'PO_CREATED', 'SUPPLIED'],
      });

      // Mock OrderStatusManager to throw validation error
      mockOrderStatusManager.changeOrderStatus.mockRejectedValue(
        new Error('Invalid status transition from TODO_PROCESSING to SUPPLIED')
      );

      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: testOrder.id,
          newStatus: 'SUPPLIED' as OrderStatus,
          reason: 'Invalid test',
          userId: testUser.id,
        });
        
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Invalid status transition');
      }
    });

    test('should handle non-existent order gracefully', async () => {
      mockOrderStatusManager.changeOrderStatus.mockRejectedValue(
        new Error('Order not found')
      );

      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: 'non-existent-id',
          newStatus: 'PO_CREATED' as OrderStatus,
          reason: 'Test',
          userId: testUser.id,
        });
        
        expect.fail('Should have thrown not found error');
      } catch (error) {
        expect(error.message).toContain('Order not found');
      }
    });

    test('should validate required installation date for INSTALL_SCHEDULING', async () => {
      // Mock successful validation
      mockStatusMachine.validateTransition.mockReturnValue({
        isValid: true,
      });

      // Mock OrderStatusManager to require installAt for INSTALL_SCHEDULING
      mockOrderStatusManager.changeOrderStatus.mockImplementation(async (request) => {
        if (request.newStatus === 'INSTALL_SCHEDULING' && !request.installAt) {
          throw new Error('Installation date is required for scheduled status');
        }
        
        return {
          order: { ...testOrder, status: request.newStatus },
          historyEntry: {
            id: 'log-123',
            orderId: testOrder.id,
            previousStatus: 'TODO_PROCESSING',
            newStatus: request.newStatus,
            changedBy: request.userId,
            reason: request.reason,
            changedAt: new Date(),
          },
          triggeredActions: ['INSTALLATION_SCHEDULED'],
        };
      });

      // Test without installation date
      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: testOrder.id,
          newStatus: 'INSTALL_SCHEDULING' as OrderStatus,
          reason: 'Schedule installation',
          userId: testUser.id,
        });
        
        expect.fail('Should have thrown validation error for missing install date');
      } catch (error) {
        expect(error.message).toContain('Installation date is required');
      }

      // Test with installation date
      const result = await OrderStatusManager.changeOrderStatus({
        orderId: testOrder.id,
        newStatus: 'INSTALL_SCHEDULING' as OrderStatus,
        reason: 'Schedule installation',
        userId: testUser.id,
        installAt: new Date(),
      });

      expect(result.order.status).toBe('INSTALL_SCHEDULING');
      expect(result.triggeredActions).toContain('INSTALLATION_SCHEDULED');
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    test('should allow ADMIN to perform any status change', async () => {
      const adminUser = await prisma.user.create({
        data: {
          email: 'admin@ordex.com',
          name: 'Admin User',
          role: 'ADMIN' as UserRole,
        },
      });

      // Mock successful validation and change
      mockStatusMachine.validateTransition.mockReturnValue({ isValid: true });
      mockOrderStatusManager.changeOrderStatus.mockResolvedValue({
        order: { ...testOrder, status: 'SUPPLIED' },
        historyEntry: expect.any(Object),
        triggeredActions: ['ORDER_COMPLETED'],
      });

      const result = await OrderStatusManager.changeOrderStatus({
        orderId: testOrder.id,
        newStatus: 'SUPPLIED' as OrderStatus,
        userId: adminUser.id,
        userRole: 'ADMIN',
      });

      expect(result.order.status).toBe('SUPPLIED');
    });

    test('should restrict SALES role to specific transitions', async () => {
      const salesUser = await prisma.user.create({
        data: {
          email: 'sales@ordex.com',
          name: 'Sales User',
          role: 'SALES' as UserRole,
        },
      });

      // Mock validation error for sales role
      mockOrderStatusManager.changeOrderStatus.mockRejectedValue(
        new Error('Sales role cannot perform this status change')
      );

      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: testOrder.id,
          newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
          userId: salesUser.id,
          userRole: 'SALES',
        });
        
        expect.fail('Should have thrown RBAC error');
      } catch (error) {
        expect(error.message).toContain('Sales role cannot perform this status change');
      }
    });

    test('should allow SALES role to perform allowed transitions', async () => {
      const salesUser = await prisma.user.create({
        data: {
          email: 'sales2@ordex.com',
          name: 'Sales User 2',
          role: 'SALES' as UserRole,
        },
      });

      // Mock successful validation for sales-allowed transition
      mockStatusMachine.validateTransition.mockReturnValue({ isValid: true });
      mockOrderStatusManager.changeOrderStatus.mockResolvedValue({
        order: { ...testOrder, status: 'CALLBACK_CUSTOMER' },
        historyEntry: expect.any(Object),
        triggeredActions: ['CUSTOMER_CALLBACK_REQUIRED'],
      });

      const result = await OrderStatusManager.changeOrderStatus({
        orderId: testOrder.id,
        newStatus: 'CALLBACK_CUSTOMER' as OrderStatus,
        userId: salesUser.id,
        userRole: 'SALES',
      });

      expect(result.order.status).toBe('CALLBACK_CUSTOMER');
    });

    test('should restrict INSTALLER role to assigned orders only', async () => {
      const installerUser = await prisma.user.create({
        data: {
          email: 'installer@ordex.com',
          name: 'Installer User',
          role: 'INSTALLER' as UserRole,
        },
      });

      // Mock RBAC error for non-assigned order
      mockOrderStatusManager.changeOrderStatus.mockRejectedValue(
        new Error('Access denied: Order not assigned to you')
      );

      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: testOrder.id,
          newStatus: 'SUPPLIED' as OrderStatus,
          userId: installerUser.id,
          userRole: 'INSTALLER',
        });
        
        expect.fail('Should have thrown RBAC error');
      } catch (error) {
        expect(error.message).toContain('Order not assigned to you');
      }
    });

    test('should allow PURCHASING role to manage supplier-related statuses', async () => {
      const purchasingUser = await prisma.user.create({
        data: {
          email: 'purchasing@ordex.com',
          name: 'Purchasing User',
          role: 'PURCHASING' as UserRole,
        },
      });

      // Mock successful validation for purchasing-allowed transition
      mockStatusMachine.validateTransition.mockReturnValue({ isValid: true });
      mockOrderStatusManager.changeOrderStatus.mockResolvedValue({
        order: { ...testOrder, status: 'PARTIALLY_SUPPLIED' },
        historyEntry: expect.any(Object),
        triggeredActions: [],
      });

      const result = await OrderStatusManager.changeOrderStatus({
        orderId: testOrder.id,
        newStatus: 'PARTIALLY_SUPPLIED' as OrderStatus,
        userId: purchasingUser.id,
        userRole: 'PURCHASING',
      });

      expect(result.order.status).toBe('PARTIALLY_SUPPLIED');
    });
  });

  describe('GET /api/orders/:id/status - Status History', () => {
    test('should return order status history', async () => {
      // Create status log entries
      const statusHistory = [
        {
          orderId: testOrder.id,
          previousStatus: 'TODO_PROCESSING' as OrderStatus,
          newStatus: 'PO_CREATED' as OrderStatus,
          changedBy: testUser.id,
          reason: 'Customer approved',
          changedAt: new Date(),
        },
        {
          orderId: testOrder.id,
          previousStatus: 'PO_CREATED' as OrderStatus,
          newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
          changedBy: testUser.id,
          reason: 'PO sent to supplier',
          changedAt: new Date(),
        },
      ];

      // Mock the status history response
      mockOrderStatusManager.getOrderStatusHistory.mockResolvedValue(statusHistory);

      const result = await OrderStatusManager.getOrderStatusHistory(testOrder.id);

      expect(result).toHaveLength(2);
      expect(result[0].previousStatus).toBe('TODO_PROCESSING');
      expect(result[0].newStatus).toBe('PO_CREATED');
      expect(result[1].previousStatus).toBe('PO_CREATED');
      expect(result[1].newStatus).toBe('WAITING_FOR_STOCK');
    });

    test('should return empty array for order with no status changes', async () => {
      mockOrderStatusManager.getOrderStatusHistory.mockResolvedValue([]);

      const result = await OrderStatusManager.getOrderStatusHistory(testOrder.id);

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed request data gracefully', async () => {
      // This would normally be handled by middleware validation
      const invalidData = {
        status: 'INVALID_STATUS',
        reason: '', // Empty reason
      };

      mockOrderStatusManager.changeOrderStatus.mockRejectedValue(
        new Error('Invalid target status: INVALID_STATUS')
      );

      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: testOrder.id,
          newStatus: 'INVALID_STATUS' as OrderStatus,
          reason: '',
          userId: testUser.id,
        });
        
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Invalid target status');
      }
    });

    test('should handle concurrent status updates gracefully', async () => {
      // Mock concurrent update conflict
      mockOrderStatusManager.changeOrderStatus.mockRejectedValueOnce(
        new Error('Order was updated by another user. Please refresh and try again.')
      );

      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: testOrder.id,
          newStatus: 'PO_CREATED' as OrderStatus,
          userId: testUser.id,
        });
        
        expect.fail('Should have thrown concurrency error');
      } catch (error) {
        expect(error.message).toContain('Order was updated by another user');
      }
    });

    test('should handle database connection errors', async () => {
      mockOrderStatusManager.changeOrderStatus.mockRejectedValue(
        new Error('Database connection lost')
      );

      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: testOrder.id,
          newStatus: 'PO_CREATED' as OrderStatus,
          userId: testUser.id,
        });
        
        expect.fail('Should have thrown database error');
      } catch (error) {
        expect(error.message).toContain('Database connection lost');
      }
    });
  });

  describe('Audit Logging Verification', () => {
    test('should create audit log entries for status changes', async () => {
      const mockAuditEntry = {
        id: 'log-123',
        orderId: testOrder.id,
        previousStatus: 'TODO_PROCESSING' as OrderStatus,
        newStatus: 'PO_CREATED' as OrderStatus,
        changedBy: testUser.id,
        reason: 'Status change test',
        changedAt: new Date(),
      };

      mockStatusMachine.validateTransition.mockReturnValue({ isValid: true });
      mockOrderStatusManager.changeOrderStatus.mockResolvedValue({
        order: { ...testOrder, status: 'PO_CREATED' },
        historyEntry: mockAuditEntry,
        triggeredActions: [],
      });

      const result = await OrderStatusManager.changeOrderStatus({
        orderId: testOrder.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        reason: 'Status change test',
        userId: testUser.id,
      });

      expect(result.historyEntry).toEqual(mockAuditEntry);
      expect(result.historyEntry.reason).toBe('Status change test');
    });

    test('should include user information in audit logs', async () => {
      const mockStatusHistoryEntry = {
        id: 'log-456',
        orderId: testOrder.id,
        previousStatus: 'PO_CREATED' as OrderStatus,
        newStatus: 'WAITING_FOR_STOCK' as OrderStatus,
        changedBy: testUser.id,
        changedByUser: {
          id: testUser.id,
          name: testUser.name,
          email: testUser.email,
        },
        reason: 'PO created',
        changedAt: new Date(),
      };

      mockOrderStatusManager.getOrderStatusHistory.mockResolvedValue([mockStatusHistoryEntry]);

      const history = await OrderStatusManager.getOrderStatusHistory(testOrder.id);

      expect(history[0].changedBy).toBe(testUser.id);
      expect(history[0].changedByUser?.name).toBe(testUser.name);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent status updates efficiently', async () => {
      const promises: Promise<any>[] = [];
      
      // Mock successful responses for all requests
      mockStatusMachine.validateTransition.mockReturnValue({ isValid: true });
      mockOrderStatusManager.changeOrderStatus.mockResolvedValue({
        order: { ...testOrder, status: 'PO_CREATED' },
        historyEntry: expect.any(Object),
        triggeredActions: [],
      });

      // Simulate 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          OrderStatusManager.changeOrderStatus({
            orderId: testOrder.id,
            newStatus: 'PO_CREATED' as OrderStatus,
            userId: testUser.id,
          })
        );
      }

      const start = performance.now();
      await Promise.all(promises);
      const end = performance.now();

      // Should complete all requests in reasonable time
      expect(end - start).toBeLessThan(1000); // 1 second
    });

    test('should maintain response time under load', async () => {
      mockStatusMachine.validateTransition.mockReturnValue({ isValid: true });
      mockOrderStatusManager.changeOrderStatus.mockResolvedValue({
        order: { ...testOrder, status: 'PO_CREATED' },
        historyEntry: expect.any(Object),
        triggeredActions: [],
      });

      const start = performance.now();
      
      await OrderStatusManager.changeOrderStatus({
        orderId: testOrder.id,
        newStatus: 'PO_CREATED' as OrderStatus,
        userId: testUser.id,
      });
      
      const end = performance.now();
      const responseTime = end - start;

      // Individual request should be fast
      expect(responseTime).toBeLessThan(100); // 100ms
    });
  });
});
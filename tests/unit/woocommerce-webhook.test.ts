import { prisma } from '@/lib/db';
import { WooCommerceWebhookProcessor } from '@/lib/webhooks/woocommerce';
import { getWooCommerceClient } from '@/lib/woocommerce';
import { describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      upsert: vi.fn().mockResolvedValue({ id: 'local-order-id' }),
      findFirst: vi.fn(), // mock findFirst for upsert logic in webhook
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'local-order-id' }),
    },
    product: {
      upsert: vi.fn(),
    },
    statusHistory: {
      create: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/woocommerce', () => ({
  getWooCommerceClient: vi.fn(),
}));

// Mock the service using its absolute path alias
vi.mock('@/lib/services/customerSync', () => ({
  CustomerSyncService: {
    ensureWooCustomer: vi.fn().mockResolvedValue(123),
    upsertCustomerProfileFromOrder: vi.fn().mockResolvedValue({
      customerId: 'customer-123',
      billingAddressId: 'addr-billing-123',
      shippingAddressId: 'addr-shipping-123',
    }),
  },
}));

describe('WooCommerceWebhookProcessor.syncOrder', () => {
  it('should fetch order and upsert it locally with customer links', async () => {
    const mockOrder = {
      id: 1001,
      number: '1001',
      status: 'processing',
      billing: {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      },
    };

    const mockWooClient = {
      getOrder: vi.fn().mockResolvedValue(mockOrder),
      updateOrderStatus: vi.fn(),
    };
    (getWooCommerceClient as any).mockReturnValue(mockWooClient);

    // Mock findFirst to return null so it attempts create
    (prisma.order.findFirst as any).mockResolvedValue(null);
    (prisma.order.create as any).mockResolvedValue({ id: 'local-order-id' });

    await WooCommerceWebhookProcessor.syncOrder(1001);

    // Verify order was fetched
    expect(mockWooClient.getOrder).toHaveBeenCalledWith(1001);

    // Verify order creation was attempted with correct IDs
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PO_CREATED', // 'processing' maps to 'PO_CREATED'
          wooOrderId: '1001',
          customerId: 'customer-123',
          billingAddressId: 'addr-billing-123',
          shippingAddressId: 'addr-shipping-123',
        }),
      })
    );

    // Verify status history
    expect(prisma.statusHistory.create).toHaveBeenCalled();
  });

  it('should handle missing client configuration', async () => {
    (getWooCommerceClient as any).mockReturnValue(null);

    await expect(WooCommerceWebhookProcessor.syncOrder(1001)).rejects.toThrow(
      'WooCommerce client not configured'
    );
  });
});

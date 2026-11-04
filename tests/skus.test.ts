import { expect, it, beforeAll } from 'vitest';
import { describeSequentialIfDatabase } from './helpers/db';
import type { PrismaClient } from '@prisma/client';

const describeIfDatabase = describeSequentialIfDatabase;

describeIfDatabase('skus crud', () => {
  let skuId: string;
  let supplierId: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Import prisma and ensure clean state
    prisma = (await import('@/lib/prisma')).prisma as PrismaClient;
    
    // Create test user for audit trail
    await prisma.user.create({
      data: {
        id: 'sku-test-user',
        email: 'sku-test@ordex.app',
        name: 'SKU Test User',
        role: 'ADMIN',
      },
    });

    // Create test supplier for SKU relationships
    const supplier = await prisma.supplier.create({
      data: {
        name: 'SKU Test Supplier',
        isActive: true
      }
    });
    supplierId = supplier.id;
  });

  it('should create a new sku', async () => {
    const skuData = {
      code: 'TEST-WIDGET-001',
      name: 'Premium Test Widget',
      description: 'A high-quality widget for testing purposes',
      attributesJson: {
        dimensions: {
          length: 10,
          width: 5,
          height: 3,
          unit: 'cm'
        },
        weight: {
          value: 0.5,
          unit: 'kg'
        },
        material: 'Stainless Steel',
        color: 'Silver',
        category: 'Widgets',
        subcategory: 'Premium Widgets',
        tags: ['premium', 'durable', 'test']
      },
      isActive: true
    };

    const sku = await prisma.sku.create({
      data: skuData
    });

    expect(sku).toBeDefined();
    expect(sku.id).toBeDefined();
    expect(sku.code).toBe(skuData.code);
    expect(sku.name).toBe(skuData.name);
    expect(sku.description).toBe(skuData.description);
    expect(sku.isActive).toBe(true);
    expect(sku.attributesJson).toEqual(skuData.attributesJson);
    expect(sku.attributesJson.material).toBe('Stainless Steel');
    expect(sku.attributesJson.tags).toContain('premium');
    expect(sku.createdAt).toBeDefined();
    expect(sku.updatedAt).toBeDefined();

    skuId = sku.id;
  });

  it('should read sku by id', async () => {
    const sku = await prisma.sku.findUnique({
      where: { id: skuId }
    });

    expect(sku).toBeDefined();
    expect(sku.id).toBe(skuId);
    expect(sku.code).toBe('TEST-WIDGET-001');
    expect(sku.name).toBe('Premium Test Widget');
    expect(sku.attributesJson.category).toBe('Widgets');
  });

  it('should read sku by unique code', async () => {
    const sku = await prisma.sku.findUnique({
      where: { code: 'TEST-WIDGET-001' }
    });

    expect(sku).toBeDefined();
    expect(sku.id).toBe(skuId);
    expect(sku.code).toBe('TEST-WIDGET-001');
  });

  it('should list all active skus', async () => {
    const skus = await prisma.sku.findMany({
      where: { isActive: true }
    });

    expect(Array.isArray(skus)).toBe(true);
    expect(skus.length).toBeGreaterThan(0);
    expect(skus.some(s => s.id === skuId)).toBe(true);
  });

  it('should update sku', async () => {
    const updatedData = {
      name: 'Updated Premium Test Widget',
      description: 'Updated description with more details',
      attributesJson: {
        dimensions: {
          length: 12, // Updated dimension
          width: 6,   // Updated dimension
          height: 3,
          unit: 'cm'
        },
        weight: {
          value: 0.6, // Updated weight
          unit: 'kg'
        },
        material: 'Titanium', // Updated material
        color: 'Silver',
        category: 'Widgets',
        subcategory: 'Premium Widgets',
        tags: ['premium', 'durable', 'test', 'updated'] // Added tag
      }
    };

    const updatedSku = await prisma.sku.update({
      where: { id: skuId },
      data: updatedData
    });

    expect(updatedSku.name).toBe(updatedData.name);
    expect(updatedSku.description).toBe(updatedData.description);
    expect(updatedSku.attributesJson.material).toBe('Titanium');
    expect(updatedSku.attributesJson.dimensions.length).toBe(12);
    expect(updatedSku.attributesJson.tags).toContain('updated');
    expect(updatedSku.updatedAt).toBeDefined();
  });

  it('should soft delete sku (mark as inactive)', async () => {
    const deactivatedSku = await prisma.sku.update({
      where: { id: skuId },
      data: { isActive: false }
    });

    expect(deactivatedSku.isActive).toBe(false);

    // Verify it doesn't appear in active SKU queries
    const activeSkus = await prisma.sku.findMany({
      where: { isActive: true }
    });

    expect(activeSkus.some(s => s.id === skuId)).toBe(false);
  });

  it('should create sku with minimal data', async () => {
    const minimalSku = await prisma.sku.create({
      data: {
        code: 'MIN-SKU-001',
        name: 'Minimal SKU',
        isActive: true
      }
    });

    expect(minimalSku).toBeDefined();
    expect(minimalSku.code).toBe('MIN-SKU-001');
    expect(minimalSku.name).toBe('Minimal SKU');
    expect(minimalSku.isActive).toBe(true);
    expect(minimalSku.description).toBeNull();
    expect(minimalSku.attributesJson).toBeNull();
  });

  it('should handle duplicate code constraint', async () => {
    await expect(
      prisma.sku.create({
        data: {
          code: 'MIN-SKU-001', // Duplicate code
          name: 'Another Minimal SKU',
          isActive: true
        }
      })
    ).rejects.toThrow();
  });

  it('should create sku with supplier relationships', async () => {
    // Create a new SKU for testing supplier relationships
    const sku = await prisma.sku.create({
      data: {
        code: 'REL-SKU-001',
        name: 'Relationship Test SKU',
        isActive: true
      }
    });

    // Create SKU-Supplier relationships with different suppliers
    const primarySkuSupplier = await prisma.skuSupplier.create({
      data: {
        productId: sku.id,
        supplierId: supplierId,
        supplierSkuCode: 'PRIMARY-001',
        leadTimeDays: 3,
        cost: 15.50,
        minOrderQty: 5,
        isPrimary: true,
        isActive: true
      }
    });

    // Create secondary supplier
    const secondarySupplier = await prisma.supplier.create({
      data: {
        name: 'Secondary Supplier',
        isActive: true
      }
    });

    const secondarySkuSupplier = await prisma.skuSupplier.create({
      data: {
        productId: sku.id,
        supplierId: secondarySupplier.id,
        supplierSkuCode: 'SECONDARY-001',
        leadTimeDays: 7,
        cost: 18.00,
        minOrderQty: 10,
        isPrimary: false,
        isActive: true
      }
    });

    // Verify the relationships
    const skuWithSuppliers = await prisma.sku.findUnique({
      where: { id: sku.id },
      include: {
        skuSuppliers: {
          include: {
            supplier: true
          }
        }
      }
    });

    expect(skuWithSuppliers?.skuSuppliers).toBeDefined();
    expect(skuWithSuppliers?.skuSuppliers.length).toBe(2);
    
    const primary = skuWithSuppliers?.skuSuppliers.find(ss => ss.isPrimary);
    const secondary = skuWithSuppliers?.skuSuppliers.find(ss => !ss.isPrimary);
    
    expect(primary).toBeDefined();
    expect(primary?.cost).toBe(15.50);
    expect(primary?.leadTimeDays).toBe(3);
    
    expect(secondary).toBeDefined();
    expect(secondary?.cost).toBe(18.00);
    expect(secondary?.leadTimeDays).toBe(7);
  });

  it('should filter skus by attributes', async () => {
    // Create SKUs with different categories for filtering
    await prisma.sku.create({
      data: {
        code: 'FILTER-001',
        name: 'Filter Test Widget',
        attributesJson: {
          category: 'Widgets',
          subcategory: 'Standard'
        },
        isActive: true
      }
    });

    await prisma.sku.create({
      data: {
        code: 'FILTER-002',
        name: 'Filter Test Component',
        attributesJson: {
          category: 'Components',
          subcategory: 'Electronic'
        },
        isActive: true
      }
    });

    // Query SKUs using JSON path operators (note: syntax may vary by database)
    const widgetSkus = await prisma.sku.findMany({
      where: {
        isActive: true,
        // Using Prisma's JSON filtering
        attributesJson: {
          path: ['category'],
          equals: 'Widgets'
        }
      }
    });

    expect(widgetSkus.length).toBeGreaterThan(0);
    expect(widgetSkus.every(sku => 
      sku.attributesJson && 
      sku.attributesJson.category === 'Widgets'
    )).toBe(true);
  });

  it('should handle order item relationships', async () => {
    // Create test customer and order
    const client = await prisma.client.create({
      data: {
        name: 'Test Client for SKU Relations'
      }
    });

    const order = await prisma.order.create({
      data: {
        number: 'ORDER-SKU-001',
        customerName: 'Test Customer',
        clientId: client.id,
        userId: 'sku-test-user',
        totalAmount: 100,
        address: 'Test Address'
      }
    });

    // Create an active SKU for order items
    const orderSku = await prisma.sku.create({
      data: {
        code: 'ORDER-SKU-001',
        name: 'Order Test SKU',
        isActive: true
      }
    });

    // Create order item with SKU
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: orderSku.id,
        qty: 5,
        unitPrice: 20.00,
        totalPrice: 100.00
      }
    });

    // Verify the relationship
    const skuWithOrderItems = await prisma.sku.findUnique({
      where: { id: orderSku.id },
      include: {
        orderItems: {
          include: {
            order: true
          }
        }
      }
    });

    expect(skuWithOrderItems?.orderItems).toBeDefined();
    expect(skuWithOrderItems?.orderItems.length).toBe(1);
    expect(skuWithOrderItems?.orderItems[0].qty).toBe(5);
    expect(skuWithOrderItems?.orderItems[0].order.number).toBe('ORDER-SKU-001');
  });
});

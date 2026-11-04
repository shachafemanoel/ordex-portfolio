import { expect, it, beforeAll } from 'vitest';
import { describeSequentialIfDatabase } from './helpers/db';

const describeIfDatabase = describeSequentialIfDatabase;

describeIfDatabase('suppliers crud', () => {
  let supplierId: string;
  let prisma: any;

  beforeAll(async () => {
    // Import prisma and ensure clean state
    prisma = (await import('@/lib/prisma')).prisma;
    
    // Create test user for audit trail
    await prisma.user.create({
      data: {
        id: 'supplier-test-user',
        email: 'supplier-test@ordex.app',
        name: 'Supplier Test User',
        role: 'ADMIN',
      },
    });
  });

  it('should create a new supplier', async () => {
    const supplierData = {
      name: 'Test Supplier Ltd',
      contactPerson: 'John Smith',
      email: 'john@testsupplier.com',
      phone: '+1234567890',
      address: '123 Supplier Street, Business City, BC 12345',
      contactJson: {
        primaryContact: {
          name: 'John Smith',
          phone: '+1234567890',
          email: 'john@testsupplier.com'
        },
        alternateContacts: [
          {
            name: 'Jane Doe',
            phone: '+1234567891',
            email: 'jane@testsupplier.com',
            role: 'Account Manager'
          }
        ]
      },
      notes: 'Reliable supplier with fast delivery times',
      isActive: true
    };

    const supplier = await prisma.supplier.create({
      data: supplierData
    });

    expect(supplier).toBeDefined();
    expect(supplier.id).toBeDefined();
    expect(supplier.name).toBe(supplierData.name);
    expect(supplier.email).toBe(supplierData.email);
    expect(supplier.phone).toBe(supplierData.phone);
    expect(supplier.isActive).toBe(true);
    expect(supplier.contactJson).toEqual(supplierData.contactJson);
    expect(supplier.createdAt).toBeDefined();
    expect(supplier.updatedAt).toBeDefined();

    supplierId = supplier.id;
  });

  it('should read supplier by id', async () => {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    expect(supplier).toBeDefined();
    expect(supplier.id).toBe(supplierId);
    expect(supplier.name).toBe('Test Supplier Ltd');
    expect(supplier.contactJson.primaryContact.name).toBe('John Smith');
  });

  it('should list all suppliers', async () => {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true }
    });

    expect(Array.isArray(suppliers)).toBe(true);
    expect(suppliers.length).toBeGreaterThan(0);
    expect(suppliers.some(s => s.id === supplierId)).toBe(true);
  });

  it('should update supplier', async () => {
    const updatedData = {
      name: 'Updated Test Supplier Ltd',
      contactJson: {
        primaryContact: {
          name: 'John Smith Updated',
          phone: '+1234567890',
          email: 'john.updated@testsupplier.com'
        }
      },
      notes: 'Updated notes about supplier performance'
    };

    const updatedSupplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: updatedData
    });

    expect(updatedSupplier.name).toBe(updatedData.name);
    expect(updatedSupplier.contactJson.primaryContact.name).toBe('John Smith Updated');
    expect(updatedSupplier.notes).toBe(updatedData.notes);
    expect(updatedSupplier.updatedAt).toBeDefined();
  });

  it('should soft delete supplier (mark as inactive)', async () => {
    const deactivatedSupplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: { isActive: false }
    });

    expect(deactivatedSupplier.isActive).toBe(false);

    // Verify it doesn't appear in active supplier queries
    const activeSuppliers = await prisma.supplier.findMany({
      where: { isActive: true }
    });

    expect(activeSuppliers.some(s => s.id === supplierId)).toBe(false);
  });

  it('should create supplier with minimal data', async () => {
    const minimalSupplier = await prisma.supplier.create({
      data: {
        name: 'Minimal Supplier',
        isActive: true
      }
    });

    expect(minimalSupplier).toBeDefined();
    expect(minimalSupplier.name).toBe('Minimal Supplier');
    expect(minimalSupplier.isActive).toBe(true);
    expect(minimalSupplier.email).toBeNull();
    expect(minimalSupplier.phone).toBeNull();
    expect(minimalSupplier.contactJson).toBeNull();
  });

  it('should handle duplicate name constraint', async () => {
    await expect(
      prisma.supplier.create({
        data: {
          name: 'Minimal Supplier', // Duplicate name
          isActive: true
        }
      })
    ).rejects.toThrow();
  });

  it('should validate supplier with SKU relationships', async () => {
    // Create a test supplier for SKU relationship
    const supplier = await prisma.supplier.create({
      data: {
        name: 'SKU Test Supplier',
        isActive: true
      }
    });

    // Create a test SKU
    const sku = await prisma.sku.create({
      data: {
        code: 'TEST-SKU-001',
        name: 'Test SKU for Supplier',
        isActive: true
      }
    });

    // Create SKU-Supplier relationship
    const skuSupplier = await prisma.skuSupplier.create({
      data: {
        productId: sku.id,
        supplierId: supplier.id,
        supplierSkuCode: 'SUPPLIER-CODE-001',
        leadTimeDays: 5,
        cost: 25.99,
        minOrderQty: 10,
        isPrimary: true,
        isActive: true
      }
    });

    expect(skuSupplier).toBeDefined();
    expect(skuSupplier.supplierSkuCode).toBe('SUPPLIER-CODE-001');
    expect(skuSupplier.cost).toBe(25.99);
    expect(skuSupplier.isPrimary).toBe(true);

    // Verify the relationship works both ways
    const supplierWithSkus = await prisma.supplier.findUnique({
      where: { id: supplier.id },
      include: { skuSuppliers: true }
    });

    expect(supplierWithSkus?.skuSuppliers).toBeDefined();
    expect(supplierWithSkus?.skuSuppliers.length).toBe(1);
  });
});
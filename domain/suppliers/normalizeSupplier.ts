/**
 * Supplier normalization utilities
 */

import type { SupplierDTO } from '@/domain/suppliers/supplierDTO';

export type { SupplierDTO };

export function normalizeSupplier(supplier: any): SupplierDTO | null {
  if (!supplier || !supplier.id) return null;

  const isActive =
    supplier.isActive !== undefined
      ? Boolean(supplier.isActive)
      : supplier.status === 'active' || supplier.status === undefined
        ? true
        : false;

  return {
    id: supplier.id,
    name: supplier.name || '',
    govId: supplier.govId || supplier.taxId || null,
    address: supplier.address || null,
    email: supplier.email || null,
    phone: supplier.phone || supplier.phoneNumber || null,
    paymentTerms: supplier.paymentTerms || supplier.payment_terms || null,
    rating: supplier.rating || null,
    isActive,
    createdAt: supplier.createdAt
      ? new Date(supplier.createdAt).toISOString()
      : new Date().toISOString(),
    updatedAt: supplier.updatedAt
      ? new Date(supplier.updatedAt).toISOString()
      : new Date().toISOString(),
    productsCount: supplier._count?.products ?? supplier.productsCount ?? 0,
    purchaseOrdersCount: supplier._count?.purchaseOrders ?? supplier.purchaseOrdersCount ?? 0,
    lastPurchaseOrderAt: supplier.lastPurchaseOrderAt
      ? new Date(supplier.lastPurchaseOrderAt).toISOString()
      : null,
  };
}

export function normalizeSuppliers(suppliers: any[]): SupplierDTO[] {
  if (!Array.isArray(suppliers)) return [];
  return suppliers.map(normalizeSupplier).filter((s): s is SupplierDTO => s !== null);
}

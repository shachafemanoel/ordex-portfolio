'use client';

import type { ProductDTO } from '@/domain/products/productDTO';
import { ProductRecord } from '@/components/products/workspace/types';

/**
 * Maps a ProductDTO (from the API/domain layer) to a ProductRecord (workspace UI type).
 *
 * ProductRecord is a rich UI type that adds workspace-specific fields such as
 * channels, inventoryByLocation, and stockMovements that are not yet modelled on
 * the API; those fields are filled in with sensible defaults.
 */
export function mapApiProductToRecord(product: ProductDTO): ProductRecord {
  const procurementType =
    (product.procurementType as ProductRecord['procurementType']) ??
    (product.inventoryEnabled ? 'INVENTORY' : 'DROPSHIP');

  const stock = product.stockUnits ?? product.demoStock ?? 0;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku ?? '',
    barcode: '',
    isFeatured: product.is_featured ?? false,
    status: product.isActive ? 'ACTIVE' : 'DRAFT',
    stock,
    lowStockThreshold: product.reorderLevel ?? 0,
    price: product.price ?? null,
    currency: (product.currency as 'ILS' | 'USD') ?? 'ILS',
    imageUrl: product.imageUrl ?? null,
    category: 'ללא קטגוריה',
    brand: 'ללא מותג',
    supplier: product.supplier?.name ?? 'ללא ספק',
    description: product.description ?? '',
    shortDescription: product.shortDescription ?? '',
    tags:
      product.type === 'BUNDLE'
        ? ['BUNDLE']
        : product.type === 'SERVICE'
          ? ['SERVICE']
          : [],
    channels: [
      {
        channel: 'ONLINE',
        enabled: true,
        syncState: 'SYNCED',
        lastSyncedAt: product.updatedAt,
      },
      {
        channel: 'OFFLINE',
        enabled: true,
        syncState: 'SYNCED',
        lastSyncedAt: product.updatedAt,
      },
      {
        channel: 'WOOCOMMERCE',
        enabled: Boolean(product.wooId),
        syncState: product.wooId ? 'SYNCED' : 'PENDING',
        lastSyncedAt: product.wooId ? product.updatedAt : null,
      },
    ],
    hasVariants: false,
    parentProductId: product.parentId ?? undefined,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    supplierSku: null,
    moq: null,
    costPrice: null,
    taxClass: null,
    procurementType,
    leadTimeDays: procurementType === 'INVENTORY' ? 3 : 14,
    inventoryByLocation: [
      {
        id: `loc-${product.id}`,
        locationName: 'מחסן ראשי',
        available: stock,
        reserved: 0,
        reorderPoint: product.reorderLevel ?? 0,
      },
    ],
    stockMovements: [],
  };
}

/**
 * Converts a ProductRecord back to an API update payload.
 * Used when persisting edits from the ProductDrawer.
 */
export function mapProductRecordToUpdatePayload(record: ProductRecord) {
  return {
    name: record.name,
    sku: record.sku,
    description: record.description || null,
    shortDescription: record.shortDescription || null,
    imageUrl: record.imageUrl || null,
    basePriceCents: record.price !== null ? Math.round(record.price * 100) : null,
    demoStock: record.stock,
    reorderLevel: record.lowStockThreshold,
    procurementType: record.procurementType,
    isActive: record.status === 'ACTIVE',
    is_featured: record.isFeatured ?? false,
    inventoryEnabled: record.procurementType === 'INVENTORY',
  };
}

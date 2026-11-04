/**
 * Product normalization utilities
 * Ensures consistent product data structure across the application
 */
import type { ProductDTO, ProductSupplierSummary } from '@/domain/products/productDTO';

function toCents(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return Math.round(numeric);
}

function derivePriceCents(product: any): number | null {
  if (product.basePriceCents !== undefined && product.basePriceCents !== null) {
    return Number(product.basePriceCents);
  }
  if (product.priceCents !== undefined && product.priceCents !== null) {
    return Number(product.priceCents);
  }
  if (product.price !== undefined && product.price !== null) {
    return Math.round(Number(product.price) * 100);
  }
  if (product.unitPrice !== undefined && product.unitPrice !== null) {
    return Math.round(Number(product.unitPrice) * 100);
  }
  return null;
}

function normalizeSupplier(product: any): ProductSupplierSummary | null {
  const supplier =
    product?.defaultSupplier ??
    product?.supplier ??
    product?.primarySupplier ??
    product?.productSuppliers?.[0];
  if (!supplier) {
    return null;
  }
  return {
    id: supplier.id ?? supplier.supplierId ?? '',
    name: supplier.name ?? supplier.supplierName ?? 'ללא שם',
  };
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Normalizes a product object from various sources (Prisma, API, WooCommerce, legacy)
 */
export function normalizeProduct(product: any): ProductDTO | null {
  if (!product || !product.id) return null;

  const sku = product.sku || product.productSku || product.code || '';
  const name = product.name || product.productName || product.title || '';
  const description = product.description || product.desc || null;
  const priceCents = derivePriceCents(product);
  const price = priceCents !== null ? priceCents / 100 : null;
  const stockUnits =
    typeof product.stockUnits === 'number'
      ? product.stockUnits
      : typeof product.stock === 'number'
        ? product.stock
        : (product.demoStock ?? null);
  const ordersCount = product.ordersCount ?? product.orderCount ?? product._count?.orderItems ?? 0;

  const createdAt = toIsoString(product.createdAt);
  const updatedAt = toIsoString(product.updatedAt ?? createdAt);

  // New fields
  const isActive = product.isActive ?? true;
  const inventoryEnabled = product.inventoryEnabled ?? true;
  const reorderLevel = product.reorderLevel ?? 0;
  const type = product.type ?? 'SIMPLE';
  const procurementType = product.procurementType ?? 'INVENTORY';
  const isBundle = product.isBundle ?? type === 'BUNDLE';

  const salePriceCents = toCents(product.sale_price_cents ?? product.salePriceCents);
  const salePriceValue = salePriceCents !== null ? salePriceCents / 100 : null;
  const imageUrl = product.imageUrl ?? product.image_url ?? null;
  const shortDescription = product.shortDescription ?? product.short_description ?? null;

  return {
    id: product.id,
    sku,
    name,
    description,
    shortDescription,
    imageUrl,
    priceCents,
    price,
    basePriceCents: priceCents,
    basePrice: price,
    salePriceCents,
    salePrice: salePriceValue,
    currency: product.currency ?? 'ILS',
    demoStock: product.demoStock ?? null,
    stockUnits,
    ordersCount,
    supplier: normalizeSupplier(product),
    createdAt,
    updatedAt,
    isActive,
    is_featured: product.is_featured ?? product.isFeatured ?? false,
    inventoryEnabled,
    reorderLevel,
    type,
    procurementType,
    isBundle,
    parentId: product.parentId ?? null,
    wooId: product.wooId ?? null,
  };
}

/**
 * Normalizes an array of products
 */
export function normalizeProducts(products: any[]): ProductDTO[] {
  if (!Array.isArray(products)) return [];
  return products.map(normalizeProduct).filter((p): p is ProductDTO => p !== null);
}

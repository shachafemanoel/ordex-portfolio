/**
 * Canonical Product DTO definitions
 */

export interface ProductSupplierSummary {
  id: string;
  name: string;
}

export interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  priceCents: number | null;
  price: number | null;
  basePriceCents: number | null;
  basePrice: number | null;
  salePriceCents?: number | null;
  salePrice?: number | null;
  currency: string;
  demoStock: number | null;
  stockUnits: number | null;
  ordersCount: number;
  supplier?: ProductSupplierSummary | null;
  createdAt: string;
  updatedAt: string;
  // New fields
  isActive: boolean;
  is_featured: boolean;
  inventoryEnabled: boolean;
  reorderLevel: number;
  type: string; // 'SIMPLE' | 'BUNDLE' | 'SERVICE' | 'VARIABLE'
  procurementType?: string; // 'INVENTORY' | 'DROPSHIP' | 'SPECIAL_ORDER'
  isBundle?: boolean;
  parentId?: string | null;
  wooId?: number | null;
}

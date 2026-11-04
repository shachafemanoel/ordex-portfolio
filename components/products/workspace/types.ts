export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
export type ProcurementType = 'INVENTORY' | 'DROPSHIP' | 'SPECIAL_ORDER';

export type SalesChannelKey = 'ONLINE' | 'OFFLINE' | 'WOOCOMMERCE';

export type SalesChannelSyncState = 'SYNCED' | 'PENDING' | 'FAILED';

export type ProductTag = 'BUNDLE' | 'SERVICE' | 'VARIANT' | 'SEASONAL';

export type ProductIssue =
  | 'LOW_STOCK'
  | 'MISSING_IMAGE'
  | 'MISSING_PRICE'
  | 'MISSING_SKU'
  | 'NOT_SYNCED';

export interface SalesChannelStatus {
  channel: SalesChannelKey;
  enabled: boolean;
  syncState: SalesChannelSyncState;
  lastSyncedAt: string | null;
}

export interface InventoryLocationStock {
  id: string;
  locationName: string;
  available: number;
  reserved: number;
  reorderPoint: number;
}

export interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  createdAt: string;
  updatedBy: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  isFeatured?: boolean;
  status: ProductStatus;
  stock: number;
  lowStockThreshold: number;
  price: number | null;
  currency: 'ILS' | 'USD';
  imageUrl: string | null;
  category: string;
  brand: string;
  supplier: string;
  description: string;
  shortDescription: string;
  tags: ProductTag[];
  channels: SalesChannelStatus[];
  hasVariants: boolean;
  variantLabel?: string;
  parentProductId?: string;
  createdAt: string;
  updatedAt: string;
  supplierSku?: string | null;
  moq?: number | null;
  costPrice?: number | null;
  taxClass?: string | null;
  procurementType: ProcurementType;
  leadTimeDays?: number | null;
  inventoryByLocation: InventoryLocationStock[];
  stockMovements: StockMovement[];
}

export interface ProductFiltersState {
  tab: 'ALL' | ProductStatus;
  query: string;
  category: string;
  brand: string;
  supplier: string;
  procurementType: 'ALL' | ProcurementType;
  channel: 'ALL' | SalesChannelKey;
  showVariantsAsRows: boolean;
  quick: {
    lowStock: boolean;
    inactive: boolean;
    missingImage: boolean;
  };
  focusIssue: ProductIssue | null;
}

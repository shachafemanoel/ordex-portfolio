/**
 * Product Components - Centralized Exports
 *
 * Import product-related components from this barrel export file.
 */

// Phase 5: Mobile UI Integration
export { ProductCardAdapter, transformProduct } from '@/components/products/ProductCardAdapter';
export type { ProductCardAdapterProps, PrismaProductForCard } from '@/components/products/ProductCardAdapter';

// Catalog Components
export { ProductCatalog } from '@/components/products/catalog/ProductCatalog';
export { CategorySection } from '@/components/products/catalog/CategorySection';

// Workspace Types
export type { ProductRecord, ProductStatus, ProcurementType } from '@/components/products/workspace/types';

/**
 * Products Repository Interface
 *
 * Defines the contract for product/SKU data access operations.
 *
 * @module lib/repositories/interfaces/IProductsRepository
 */

import type { Product } from '@prisma/client';

/**
 * Product filter criteria
 */
export interface ProductFilter {
  sku?: string;
  supplierId?: string;
  isActive?: boolean;
  search?: string; // Search in name, sku, description
}

/**
 * Product with relations
 */
export interface ProductWithRelations extends Product {
  defaultSupplier?: any;
  orderItems?: any[];
}

/**
 * Create product input
 */
export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  basePriceCents?: number;
  supplierId?: string;
  isActive?: boolean;
}

/**
 * Update product input
 */
export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  basePriceCents?: number;
  supplierId?: string;
  isActive?: boolean;
}

/**
 * Products Repository Interface
 */
export interface IProductsRepository {
  /**
   * Find product by ID
   */
  findById(id: string, includeRelations?: boolean): Promise<ProductWithRelations | null>;

  /**
   * Find product by SKU
   */
  findBySku(sku: string): Promise<ProductWithRelations | null>;

  /**
   * Find products by filter
   */
  findMany(filter?: ProductFilter): Promise<ProductWithRelations[]>;

  /**
   * Find products by supplier
   */
  findBySupplier(supplierId: string): Promise<ProductWithRelations[]>;

  /**
   * Create a new product
   */
  create(data: CreateProductInput): Promise<ProductWithRelations>;

  /**
   * Update an existing product
   */
  update(id: string, data: UpdateProductInput): Promise<ProductWithRelations>;

  /**
   * Delete a product
   */
  delete(id: string): Promise<void>;

  /**
   * Check if product exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Search products
   */
  search(query: string, limit?: number): Promise<ProductWithRelations[]>;

  /**
   * Execute operation in transaction
   */
  transaction<T>(fn: (repo: IProductsRepository) => Promise<T>): Promise<T>;
}

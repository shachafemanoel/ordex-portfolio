/**
 * Repository Interfaces
 *
 * Exports all repository interface definitions
 *
 * @module lib/repositories/interfaces
 */

export type {
  IOrdersRepository,
  OrderFilter,
  OrderWithRelations,
  CreateOrderInput,
  CreateOrderItemInput,
  UpdateOrderInput,
  PaginationOptions,
  PaginatedResult,
} from './IOrdersRepository';

export type {
  ICustomersRepository,
  CustomerFilter,
  CustomerWithRelations,
  CreateCustomerInput,
  UpdateCustomerInput,
} from './ICustomersRepository';

export type {
  IProductsRepository,
  ProductFilter,
  ProductWithRelations,
  CreateProductInput,
  UpdateProductInput,
} from './IProductsRepository';

/**
 * Customers Repository Interface
 *
 * Defines the contract for customer data access operations.
 *
 * @module lib/repositories/interfaces/ICustomersRepository
 */

import type { Customer } from '@prisma/client';

/**
 * Customer filter criteria
 */
export interface CustomerFilter {
  email?: string;
  phone?: string;
  search?: string; // Search in name, email, phone
  creditLimitAbove?: number;
  currentBalanceAbove?: number;
  currentBalanceBelow?: number;
}

/**
 * Customer with relations
 */
export interface CustomerWithRelations extends Customer {
  addresses?: any[];
  orders?: any[];
  ledgerEntries?: any[];
}

/**
 * Create customer input
 */
export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  creditLimitCents?: number;
  paymentTermsDays?: number;
  accountNotes?: string;
}

/**
 * Update customer input
 */
export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string;
  creditLimitCents?: number;
  paymentTermsDays?: number;
  accountNotes?: string;
  currentBalanceCents?: number;
}

/**
 * Customers Repository Interface
 */
export interface ICustomersRepository {
  /**
   * Find customer by ID
   */
  findById(id: string, includeRelations?: boolean): Promise<CustomerWithRelations | null>;

  /**
   * Find customer by email
   */
  findByEmail(email: string): Promise<CustomerWithRelations | null>;

  /**
   * Find customer by phone
   */
  findByPhone(phone: string): Promise<CustomerWithRelations | null>;

  /**
   * Find customers by filter
   */
  findMany(filter?: CustomerFilter): Promise<CustomerWithRelations[]>;

  /**
   * Create a new customer
   */
  create(data: CreateCustomerInput): Promise<CustomerWithRelations>;

  /**
   * Update an existing customer
   */
  update(id: string, data: UpdateCustomerInput): Promise<CustomerWithRelations>;

  /**
   * Delete a customer
   */
  delete(id: string): Promise<void>;

  /**
   * Update customer balance
   */
  updateBalance(id: string, deltaCents: number): Promise<CustomerWithRelations>;

  /**
   * Get customer with account summary
   */
  getAccountSummary(id: string): Promise<{
    customer: CustomerWithRelations;
    outstandingOrders: number;
    overdueAmount: number;
    availableCredit: number;
  }>;

  /**
   * Check if customer exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Execute operation in transaction
   */
  transaction<T>(fn: (repo: ICustomersRepository) => Promise<T>): Promise<T>;
}

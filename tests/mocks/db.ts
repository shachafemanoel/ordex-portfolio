/**
 * Prisma client shim for backward compatibility.
 *
 * In vitest, the exact `@/lib/db` import is aliased to this test-only file.
 * This module provides stub exports so that all imports of `@/lib/db`
 * resolve without crashing in the test environment.
 *
 * Individual tests should vi.mock('@/lib/db') when they need a functioning mock.
 */

export const prisma = undefined as any;
export const prismaClient = prisma;
export default prisma;

export function getPrismaClient() {
  return prisma;
}

export function getBasePrismaClient() {
  return prisma;
}

export async function checkDatabaseConnection() {
  return { healthy: false, message: 'Test environment – no real DB connection' };
}

export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>
): Promise<T> {
  throw new Error('Database not initialised – cannot run transaction in test');
}

export function getConnectionMetrics() {
  return {};
}

export async function closeDatabaseConnection() {
  // no-op in tests
}

export async function initializePrisma() {
  return false;
}

export async function validateConnection() {
  return false;
}

// Re-export types that consumers may need
export type {
  Address,
  Customer,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderNote,
  OrderPriority,
  OrderStatus,
  TaskStatus,
  User,
  UserRole,
} from '@prisma/client';

export async function withIdentityDatabase<T>(_operation: (tx: any) => Promise<T>): Promise<T> {
  throw new Error('Identity database must be explicitly mocked in unit tests');
}

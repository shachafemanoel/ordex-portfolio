import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import { AuthenticationError } from '@/lib/auth/errors';

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: 'ADMIN' | 'OPERATIONS';
}

// The production bundle can hold more than one copy of this module (for example a route chunk
// and a server-rendering chunk). Each copy creating its own storage would hide the business
// context one copy sets from the database layer bound to another, so they share one per process.
const shared = globalThis as typeof globalThis & {
  __retzefTenantStorage?: AsyncLocalStorage<TenantContext>;
  __retzefTenantTransactionStorage?: AsyncLocalStorage<Prisma.TransactionClient>;
};
export const tenantStorage = (shared.__retzefTenantStorage ??= new AsyncLocalStorage<TenantContext>());
export const tenantTransactionStorage = (shared.__retzefTenantTransactionStorage ??=
  new AsyncLocalStorage<Prisma.TransactionClient>());

export function isTenantRuntime(): boolean {
  return process.env.TENANT_ENFORCEMENT === 'true';
}

// Only call with context established by session membership verification or the trusted worker.
export async function withTenantContext<T>(context: TenantContext, action: () => T): Promise<T> {
  if (!context.tenantId || !context.userId) throw new AuthenticationError('Business context required');
  return tenantStorage.run(context, async () => await action());
}

export async function requireTenantContext(): Promise<TenantContext> {
  const context = tenantStorage.getStore();
  if (context) return context;
  const { cookies } = await import('next/headers');
  const { SESSION_COOKIE_NAME } = await import('@/lib/auth/config');
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new AuthenticationError('Business session required');
  const { resolveTenantSession } = await import('@/lib/tenancy/session');
  return resolveTenantSession(token);
}

export async function requireTenantId(): Promise<string> {
  return (await requireTenantContext()).tenantId;
}

// Legacy data belongs to the single migrated business when enforcement is disabled.
export async function databaseTenantId(): Promise<string> {
  return isTenantRuntime() ? requireTenantId() : 'legacy';
}

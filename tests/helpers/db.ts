import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe } from 'vitest';

type DescribeLike = typeof describe;

const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const SKIP_DB_TESTS = process.env.SKIP_DB_TESTS === 'true';
const SKIP_PRISMA_INIT = process.env.SKIP_PRISMA_INIT === 'true';
const IS_DEFAULT_TEST_DB = !!process.env.DATABASE_URL?.includes('localhost:5432/ordex_test');

export const shouldRunDatabaseTests =
  Boolean(DATABASE_URL) && !SKIP_DB_TESTS && !SKIP_PRISMA_INIT && !IS_DEFAULT_TEST_DB;

const globalForTests = globalThis as unknown as {
  __ordexTestPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  if (DATABASE_URL) {
    return new PrismaClient();
  }

  // Fallback mode requested for local runs with no DATABASE_URL.
  // Prisma schema is Postgres-backed, so this is best-effort and kept opt-in.
  process.env.TEST_DATABASE_URL ??= 'file:memdb1?mode=memory&cache=shared';
  process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL;
  return new PrismaClient();
}

const shouldInitializePrisma = !SKIP_PRISMA_INIT && (shouldRunDatabaseTests || !globalForTests.__ordexTestPrisma);

export const prisma: PrismaClient =
  globalForTests.__ordexTestPrisma ?? (shouldInitializePrisma ? createPrismaClient() : ({} as PrismaClient));

if (!globalForTests.__ordexTestPrisma && shouldInitializePrisma && prisma && '$connect' in prisma) {
  globalForTests.__ordexTestPrisma = prisma;
}

export async function resetDb(): Promise<void> {
  if (!shouldRunDatabaseTests) return;

  const models = [
    prisma.task,
    prisma.purchaseOrderItem,
    prisma.purchaseOrder,
    prisma.payment,
    prisma.orderItem,
    prisma.order,
    prisma.customer,
    prisma.supplier,
    prisma.user,
  ];

  for (const model of models) {
    await model.deleteMany({});
  }
}

export async function closeDb(): Promise<void> {
  if (!shouldRunDatabaseTests) return;
  await prisma.$disconnect();
}

function withDbLifecycle(fn: () => void) {
  beforeAll(async () => {
    if (!shouldRunDatabaseTests) return;
    await prisma.$connect();
  });

  fn();

  afterAll(async () => {
    await closeDb();
  });
}

const describeDbImpl: DescribeLike = ((name: string, suite: () => void) => {
  const runner = shouldRunDatabaseTests ? describe : describe.skip;
  return runner(name, () => withDbLifecycle(suite));
}) as DescribeLike;

const describeSequentialDbImpl: DescribeLike = ((name: string, suite: () => void) => {
  const runner = shouldRunDatabaseTests ? describe.sequential : describe.skip;
  return runner(name, () => withDbLifecycle(suite));
}) as DescribeLike;

export const describeIfDatabase = describeDbImpl;
export const describeSequentialIfDatabase = describeSequentialDbImpl;

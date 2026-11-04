/**
 * Demo dataset seeding utilities
 * Stub implementation for demo mode reset functionality
 */
import type { PrismaClient } from '@prisma/client';

export interface SeedSummary {
  users: number;
  customers: number;
  orders: number;
  products: number;
}

/**
 * Resets the demo database to a clean state
 */
export async function resetDemoData(prisma: PrismaClient): Promise<void> {
  console.log('Resetting demo data...');

  // Delete data in reverse dependency order
  await prisma.statusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();

  console.log('Demo data reset complete');
}

/**
 * Seeds the database with a demo dataset
 */
export async function seedDemoDataset(prisma: PrismaClient): Promise<SeedSummary> {
  console.log('Seeding demo dataset...');

  // This is a stub - the actual seeding logic would go here
  // For now, return zeros to indicate no data was seeded

  const summary: SeedSummary = {
    users: 0,
    customers: 0,
    orders: 0,
    products: 0,
  };

  console.log('Demo dataset seeding complete:', summary);
  return summary;
}

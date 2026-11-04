/**
 * DI Container Bootstrap
 *
 * Registers all application services in the dependency injection container
 *
 * @module lib/di/bootstrap
 */

import { defaultCache, queryCache } from '@/lib/cache/cache-manager';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import { PrismaCustomersRepository } from '@/lib/repositories/implementations/PrismaCustomersRepository';
import { PrismaOrdersRepository } from '@/lib/repositories/implementations/PrismaOrdersRepository';
import { PrismaProductsRepository } from '@/lib/repositories/implementations/PrismaProductsRepository';
import type { ICustomersRepository } from '@/lib/repositories/interfaces/ICustomersRepository';
import type { IOrdersRepository } from '@/lib/repositories/interfaces/IOrdersRepository';
import type { IProductsRepository } from '@/lib/repositories/interfaces/IProductsRepository';
import { Container } from '@/lib/di/Container';

/**
 * Bootstrap the dependency injection container
 *
 * Registers all application services and their dependencies
 *
 * @param container - container instance to bootstrap
 */
export async function bootstrapContainer(container: Container): Promise<void> {
  logger.info('Bootstrapping DI container');

  // ===== Infrastructure Services =====

  // Database
  container.registerInstance('prisma', prisma);

  // Logging
  container.registerInstance('logger', logger);

  // Cache
  container.registerInstance('queryCache', queryCache);
  container.registerInstance('defaultCache', defaultCache);

  // ===== Repositories =====

  // Orders Repository
  container.registerSingleton<IOrdersRepository>('ordersRepository', (c) => {
    const prismaClient = c.resolveSync('prisma') as any;
    return new PrismaOrdersRepository(prismaClient);
  });

  // Customers Repository
  container.registerSingleton<ICustomersRepository>('customersRepository', (c) => {
    const prismaClient = c.resolveSync('prisma') as any;
    return new PrismaCustomersRepository(prismaClient);
  });

  // Products Repository
  container.registerSingleton<IProductsRepository>('productsRepository', (c) => {
    const prismaClient = c.resolveSync('prisma') as any;
    return new PrismaProductsRepository(prismaClient);
  });

  // ===== Use Cases =====
  // Use cases will be registered here as they are created
  // Example:
  // container.registerTransient('createOrderUseCase', (c) => {
  //   return new CreateOrderUseCase(
  //     c.resolveSync('ordersRepository'),
  //     c.resolveSync('customersRepository'),
  //     c.resolveSync('productsRepository'),
  //     c.resolveSync('logger')
  //   );
  // });

  logger.info('DI container bootstrapped', {
    services: container.getRegisteredServices(),
  });
}

/**
 * Create and bootstrap a new container
 *
 * @returns bootstrapped container
 */
export async function createBootstrappedContainer(): Promise<Container> {
  const container = new Container();
  await bootstrapContainer(container);
  return container;
}

/**
 * Default bootstrapped container (lazy-loaded)
 */
let defaultContainer: Container | null = null;

/**
 * Get the default bootstrapped container
 *
 * @returns bootstrapped container
 */
export async function getContainer(): Promise<Container> {
  if (!defaultContainer) {
    defaultContainer = await createBootstrappedContainer();
  }
  return defaultContainer;
}

/**
 * Reset the default container (useful for testing)
 */
export function resetContainer(): void {
  if (defaultContainer) {
    defaultContainer.clear();
    defaultContainer = null;
  }
}

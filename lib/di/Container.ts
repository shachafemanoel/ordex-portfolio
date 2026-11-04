/**
 * Dependency Injection Container
 *
 * Lightweight DI container for managing service lifecycle and dependencies.
 * Supports singleton and transient services.
 *
 * @module lib/di/Container
 */

import { logger } from '@/lib/logger';

/**
 * Service lifecycle types
 */
export enum ServiceLifetime {
  /**
   * Single instance shared across the application
   */
  SINGLETON = 'singleton',

  /**
   * New instance created on each resolve
   */
  TRANSIENT = 'transient',
}

/**
 * Service registration
 */
interface ServiceRegistration<T = any> {
  factory: (container: Container) => T | Promise<T>;
  lifetime: ServiceLifetime;
  instance?: T;
}

/**
 * Dependency Injection Container
 */
export class Container {
  private services = new Map<string, ServiceRegistration>();
  private resolving = new Set<string>(); // Circular dependency detection

  /**
   * Register a singleton service
   *
   * @param name - service name
   * @param factory - factory function to create service
   */
  registerSingleton<T>(
    name: string,
    factory: (container: Container) => T | Promise<T>
  ): void {
    if (this.services.has(name)) {
      logger.warn('Service already registered, will be replaced', { serviceName: name });
    }

    this.services.set(name, {
      factory,
      lifetime: ServiceLifetime.SINGLETON,
    });

    logger.debug('Singleton service registered', { serviceName: name });
  }

  /**
   * Register a transient service
   *
   * @param name - service name
   * @param factory - factory function to create service
   */
  registerTransient<T>(
    name: string,
    factory: (container: Container) => T | Promise<T>
  ): void {
    if (this.services.has(name)) {
      logger.warn('Service already registered, will be replaced', { serviceName: name });
    }

    this.services.set(name, {
      factory,
      lifetime: ServiceLifetime.TRANSIENT,
    });

    logger.debug('Transient service registered', { serviceName: name });
  }

  /**
   * Register an instance directly as a singleton
   *
   * @param name - service name
   * @param instance - service instance
   */
  registerInstance<T>(name: string, instance: T): void {
    this.services.set(name, {
      factory: () => instance,
      lifetime: ServiceLifetime.SINGLETON,
      instance,
    });

    logger.debug('Instance registered', { serviceName: name });
  }

  /**
   * Resolve a service by name
   *
   * @param name - service name
   * @returns service instance
   */
  async resolve<T>(name: string): Promise<T> {
    const registration = this.services.get(name);

    if (!registration) {
      throw new Error(`Service not registered: ${name}`);
    }

    // Circular dependency detection
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }

    // Return existing singleton instance
    if (registration.lifetime === ServiceLifetime.SINGLETON && registration.instance) {
      return registration.instance as T;
    }

    try {
      this.resolving.add(name);

      // Create new instance
      const instance = await registration.factory(this);

      // Store singleton instance
      if (registration.lifetime === ServiceLifetime.SINGLETON) {
        registration.instance = instance;
      }

      logger.debug('Service resolved', {
        serviceName: name,
        lifetime: registration.lifetime,
      });

      return instance as T;
    } catch (error) {
      logger.error('Error resolving service', error, { serviceName: name });
      throw error;
    } finally {
      this.resolving.delete(name);
    }
  }

  /**
   * Resolve a service synchronously (only works if service is already instantiated)
   *
   * @param name - service name
   * @returns service instance
   */
  resolveSync<T>(name: string): T {
    const registration = this.services.get(name);

    if (!registration) {
      throw new Error(`Service not registered: ${name}`);
    }

    if (registration.lifetime === ServiceLifetime.SINGLETON && registration.instance) {
      return registration.instance as T;
    }

    throw new Error(`Service not yet instantiated: ${name}. Use resolve() instead.`);
  }

  /**
   * Check if a service is registered
   *
   * @param name - service name
   * @returns true if registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Remove a service registration
   *
   * @param name - service name
   */
  unregister(name: string): void {
    this.services.delete(name);
    logger.debug('Service unregistered', { serviceName: name });
  }

  /**
   * Clear all service registrations
   */
  clear(): void {
    this.services.clear();
    this.resolving.clear();
    logger.info('Container cleared');
  }

  /**
   * Get list of registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Create a scoped child container
   *
   * Child containers inherit parent services but can override them
   *
   * @returns child container
   */
  createScope(): Container {
    const childContainer = new Container();

    // Copy parent registrations
    for (const [name, registration] of this.services.entries()) {
      childContainer.services.set(name, { ...registration });
    }

    logger.debug('Scoped container created');
    return childContainer;
  }
}

/**
 * Global container instance
 */
export const globalContainer = new Container();

/**
 * Helper function to create a container
 */
export function createContainer(): Container {
  return new Container();
}

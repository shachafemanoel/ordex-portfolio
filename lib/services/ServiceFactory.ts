/**
 * Service Factory - Central Data Management Module
 *
 * This module is responsible for:
 * 1. Creating and managing all service instances
 * 2. Handling dependencies (cache, logger, repositories)
 * 3. Managing relationships between models
 * 4. Providing a single entry point for all data operations
 *
 * All pages should use this factory instead of creating repositories directly.
 *
 * @example
 * ```typescript
 * import { ServiceFactory } from '@/lib/services/ServiceFactory';
 *
 * const factory = ServiceFactory.getInstance();
 * const ordersService = factory.getOrdersService();
 * const orders = await ordersService.listOrders(filters, pagination);
 * ```
 */

import { createCacheService, type CacheService } from '@/lib/cache/CacheService';
import { logger, type Logger } from '@/lib/logger';
import { CustomersRepository } from '@/lib/repositories/customers/CustomersRepository';
import { OrdersRepository } from '@/lib/repositories/orders/OrdersRepository';
import { ProductsRepository } from '@/lib/repositories/products/ProductsRepository';
import { AddressIntelligenceService } from '@/lib/services/address/AddressIntelligenceService';
import { AuditService } from '@/lib/services/audit/AuditService';
import { CustomersService } from '@/lib/services/customers/CustomersService';
import { DashboardService } from '@/lib/services/dashboard/DashboardService';

import { InstallationScheduleService } from '@/lib/services/installations/InstallationScheduleService';
import { GoogleMapsService } from '@/lib/services/map/GoogleMapsService';
import { MapService } from '@/lib/services/map/MapService';
import { PaymentsService } from '@/lib/services/payments/PaymentsService';
import { OrdersService } from '@/src/server/domain/orders/OrdersService';

/**
 * Singleton Service Factory
 * Manages all service instances and their dependencies
 */
export class ServiceFactory {
  private static instance: ServiceFactory | null = null;

  // Shared infrastructure
  private cache: CacheService;
  private logger: Logger;

  // Repositories (data access layer)
  private ordersRepo: OrdersRepository;
  private customersRepo: CustomersRepository;
  private productsRepo: ProductsRepository;

  // Core services
  private auditService: AuditService;
  private addressService: AddressIntelligenceService;

  // Business services (cached)
  private ordersServiceInstance?: OrdersService;
  private customersServiceInstance?: CustomersService;
  private dashboardServiceInstance?: DashboardService;
  private paymentsServiceInstance?: PaymentsService;
  private mapServiceInstance?: MapService;
  private googleMapsServiceInstance?: GoogleMapsService;
  private installationServiceInstance?: InstallationScheduleService;

  private constructor() {
    // ... no changes here
    this.cache = createCacheService();
    this.logger = logger;

    this.ordersRepo = new OrdersRepository(this.cache, this.logger);
    this.customersRepo = new CustomersRepository(this.cache, this.logger);
    this.productsRepo = new ProductsRepository(this.cache, this.logger);

    this.auditService = new AuditService();
    this.addressService = new AddressIntelligenceService();
  }

  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * Get OrdersService
   * Handles all order-related business logic
   */
  public getOrdersService(): OrdersService {
    if (!this.ordersServiceInstance) {
      this.ordersServiceInstance = new OrdersService(
        this.ordersRepo,
        this.customersRepo,
        this.productsRepo,
        this.logger,
        this.auditService,
        this.getPaymentsService(),
        this.addressService
      );
    }
    return this.ordersServiceInstance;
  }

  /**
   * Get CustomersService
   * Handles customer management and profiles
   */
  public getCustomersService(): CustomersService {
    if (!this.customersServiceInstance) {
      this.customersServiceInstance = new CustomersService(this.customersRepo, this.logger);
    }
    return this.customersServiceInstance;
  }

  public getMapService(): MapService {
    if (!this.mapServiceInstance) {
      this.mapServiceInstance = new MapService();
    }
    return this.mapServiceInstance;
  }

  /**
   * Get GoogleMapsService
   * Handles interaction with Google Maps Platform APIs
   */
  public getGoogleMapsService(): GoogleMapsService {
    if (!this.googleMapsServiceInstance) {
      this.googleMapsServiceInstance = new GoogleMapsService();
    }
    return this.googleMapsServiceInstance;
  }

  /**
   * Get InstallationScheduleService
   * Manages installation scheduling and related operations
   */
  public getInstallationService(): InstallationScheduleService {
    if (!this.installationServiceInstance) {
      this.installationServiceInstance = new InstallationScheduleService();
    }
    return this.installationServiceInstance;
  }

  // ==================== Infrastructure Getters ====================

  /**
   * Get shared cache instance
   */
  public getCache(): CacheService {
    return this.cache;
  }

  /**
   * Get shared logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get audit service
   */
  public getAuditService(): AuditService {
    return this.auditService;
  }

  /**
   * Get address intelligence service
   */
  public getAddressService(): AddressIntelligenceService {
    return this.addressService;
  }

  // ==================== Repository Getters (for advanced use) ====================

  /**
   * Get OrdersRepository (direct access - use with caution)
   * Prefer using OrdersService for business operations
   */
  public getOrdersRepository(): OrdersRepository {
    return this.ordersRepo;
  }

  /**
   * Get CustomersRepository (direct access - use with caution)
   * Prefer using CustomersService for business operations
   */
  public getCustomersRepository(): CustomersRepository {
    return this.customersRepo;
  }

  /**
   * Get ProductsRepository (direct access - use with caution)
   */
  public getProductsRepository(): ProductsRepository {
    return this.productsRepo;
  }
  /**
   * Get PaymentsService
   * Handles payment processing, invoices, and transaction history
   */
  public getPaymentsService(): PaymentsService {
    if (!this.paymentsServiceInstance) {
      this.paymentsServiceInstance = new PaymentsService(this.logger, this.auditService);
    }
    return this.paymentsServiceInstance;
  }

  /**
   * Get DashboardService
   * Aggregates data for the dashboard views
   */
  public getDashboardService(): DashboardService {
    if (!this.dashboardServiceInstance) {
      this.dashboardServiceInstance = new DashboardService();
    }
    return this.dashboardServiceInstance;
  }
}

export function getServiceFactory(): ServiceFactory {
  return ServiceFactory.getInstance();
}

export function getOrdersService(): OrdersService {
  return ServiceFactory.getInstance().getOrdersService();
}

export function getCustomersService(): CustomersService {
  return ServiceFactory.getInstance().getCustomersService();
}

export function getMapService(): MapService {
  return ServiceFactory.getInstance().getMapService();
}

export function getGoogleMapsService(): GoogleMapsService {
  return ServiceFactory.getInstance().getGoogleMapsService();
}

export function getInstallationService(): InstallationScheduleService {
  return ServiceFactory.getInstance().getInstallationService();
}

// ...

export function getPaymentsService(): PaymentsService {
  return ServiceFactory.getInstance().getPaymentsService();
}

export function getDashboardService(): DashboardService {
  return ServiceFactory.getInstance().getDashboardService();
}

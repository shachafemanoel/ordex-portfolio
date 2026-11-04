import { normalizeCustomer, normalizeCustomers } from '@/domain/customers/normalizeCustomer';
import type { CacheService } from '@/lib/cache/CacheService';
import { createCacheService } from '@/lib/cache/CacheService';
import type { Logger } from '@/lib/logger';
import { logger as defaultLogger } from '@/lib/logger';
import {
  CustomersRepository,
  type CustomerFilters,
} from '@/lib/repositories/customers/CustomersRepository';

function isCustomersRepository(value: unknown): value is CustomersRepository {
  return Boolean(value && typeof (value as CustomersRepository).list === 'function');
}

export class CustomersService {
  private repo: CustomersRepository;

  constructor(repoOrCache?: CustomersRepository | CacheService, logger?: Logger) {
    // Support both dependency injection patterns:
    // 1. Direct repository injection (from ServiceFactory)
    // 2. Cache + Logger injection (legacy)
    if (isCustomersRepository(repoOrCache)) {
      this.repo = repoOrCache;
    } else {
      const cache =
        repoOrCache && typeof (repoOrCache as CacheService).isAvailable === 'function'
          ? repoOrCache
          : createCacheService();
      this.repo = new CustomersRepository(cache, logger ?? defaultLogger);
    }
  }

  async listCustomers(filters: CustomerFilters, pagination: { page?: number; perPage?: number }) {
    const result = await this.repo.list(filters, pagination);
    return {
      items: normalizeCustomers(result.items),
      pagination: {
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        totalPages: result.totalPages,
        hasNext: result.page * result.perPage < result.total,
        hasPrev: result.page > 1,
      },
    };
  }

  async createCustomer(data: any) {
    // Extract address data that isn't native to the Customer model
    const { billingAddress, shippingAddress, ...customerData } = data;

    const addressesToCreate: any[] = [];

    if (billingAddress) {
      addressesToCreate.push({
        type: 'BILLING',
        city: billingAddress.city,
        street: billingAddress.street,
        number: billingAddress.number,
        floor: billingAddress.floor,
        apartment: billingAddress.apartment,
        notes: billingAddress.notes,
        lat: billingAddress.lat,
        lng: billingAddress.lng,
      });
    }

    if (shippingAddress) {
      addressesToCreate.push({
        type: 'SHIPPING',
        city: shippingAddress.city,
        street: shippingAddress.street,
        number: shippingAddress.number,
        floor: shippingAddress.floor,
        apartment: shippingAddress.apartment,
        notes: shippingAddress.notes,
        lat: shippingAddress.lat,
        lng: shippingAddress.lng,
      });
    }

    const createData = {
      ...customerData,
      addresses: {
        create: addressesToCreate,
      },
    };

    const created = await this.repo.create(createData);
    return normalizeCustomer(created);
  }
}

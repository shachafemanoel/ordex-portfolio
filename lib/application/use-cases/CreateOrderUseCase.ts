/**
 * Create Order Use Case
 *
 * Application service for creating orders following clean architecture principles.
 *
 * @module lib/application/use-cases/CreateOrderUseCase
 */

import { auditCreate } from '@/lib/audit';
import type { Logger } from '@/lib/logger';
import type { ICustomersRepository } from '@/lib/repositories/interfaces/ICustomersRepository';
import type {
  CreateOrderInput,
  IOrdersRepository,
  OrderWithRelations,
} from '@/lib/repositories/interfaces/IOrdersRepository';
import type { IProductsRepository } from '@/lib/repositories/interfaces/IProductsRepository';

/**
 * Create Order Request
 */
export interface CreateOrderRequest {
  customerId: string;
  billingAddressId: string;
  shippingAddressId: string;
  items: Array<{
    productId: string;
    qty: number;
  }>;
  notes?: string;
  notesInternal?: string;
  createdByUserId?: string;
}

/**
 * Create Order Response
 */
export interface CreateOrderResponse {
  order: OrderWithRelations;
}

/**
 * Create Order Use Case
 *
 * Orchestrates order creation with validation and business rules
 */
export class CreateOrderUseCase {
  constructor(
    private readonly ordersRepo: IOrdersRepository,
    private readonly customersRepo: ICustomersRepository,
    private readonly productsRepo: IProductsRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Execute use case
   */
  async execute(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    this.logger.info('Creating order', {
      customerId: request.customerId,
      itemCount: request.items.length,
    });

    // Validate customer exists
    const customer = await this.customersRepo.findById(request.customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${request.customerId}`);
    }

    // Check credit limit if configured
    if (customer.creditLimitCents && customer.creditLimitCents > 0) {
      if (customer.currentBalanceCents >= customer.creditLimitCents) {
        throw new Error('Customer has reached credit limit');
      }
    }

    // Validate and enrich order items
    const enrichedItems = await Promise.all(
      request.items.map(async (item) => {
        const product = await this.productsRepo.findById(item.productId);

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (!product.isActive) {
          throw new Error(`Product is inactive: ${product.sku}`);
        }

        const priceCents = product.basePriceCents || 0;
        const totalCents = priceCents * item.qty;

        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description || undefined,
          qty: item.qty,
          priceCents,
          totalCents,
          supplierId: product.defaultSupplierId || undefined,
        };
      })
    );

    // Calculate order totals (VAT-inclusive model)
    const totalCents = enrichedItems.reduce((sum, item) => sum + item.totalCents, 0);
    const taxRate = 0.18; // Standard Israeli VAT (2024+)
    const taxCents = Math.round(totalCents - totalCents / (1 + taxRate));
    const subTotalCents = totalCents - taxCents; // Net amount
    const shippingCents = 0; // TODO: Calculate shipping
    const discountCents = 0; // TODO: Apply discounts

    // Create order input
    const orderInput: CreateOrderInput = {
      customerId: request.customerId,
      billingAddressId: request.billingAddressId,
      shippingAddressId: request.shippingAddressId,
      subTotalCents,
      taxCents,
      shippingCents,
      discountCents,
      totalCents,
      currency: 'ILS',
      notes: request.notes,
      notesInternal: request.notesInternal,
      createdByUserId: request.createdByUserId,
      items: enrichedItems,
    };

    // Create order
    const order = await this.ordersRepo.create(orderInput);

    // Audit log
    if (request.createdByUserId) {
      await auditCreate({
        entity: 'Order',
        entityId: order.id,
        actorId: request.createdByUserId,
        data: {
          orderNumber: order.number,
          totalCents: order.totalCents,
          itemCount: enrichedItems.length,
        },
      });
    }

    this.logger.info('Order created successfully', {
      orderId: order.id,
      orderNumber: order.number,
      totalCents: order.totalCents,
    });

    return { order };
  }
}

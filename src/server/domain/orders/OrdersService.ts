import type {
  OrderCreateInput,
  OrderDTO,
  OrderListFilters,
  OrderStatusChangeInput,
  OrderUpdateInput,
  PaymentCreateInput,
} from '@/domain/orders';
import { normalizeOrder } from '@/domain/orders/normalizeOrder';
import {
  UNIFIED_ORDER_INCLUDE,
  mapOrderToUnified,
  upsertUnifiedOrder,
} from '@/lib/data/ordersRedis';
import { isTenantRuntime } from '@/lib/tenancy/context';
import { withTransaction } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors/DomainErrors';
import { Logger } from '@/lib/logger';
import { getEffectivePrice } from '@/lib/pricing';
import { PaginatedResponse, PaginationParams } from '@/lib/repositories/base/types';
import { CustomersRepository } from '@/lib/repositories/customers/CustomersRepository';
import { OrdersRepository } from '@/lib/repositories/orders/OrdersRepository';
import { ProductsRepository } from '@/lib/repositories/products/ProductsRepository';
import {
  AddressIntelligenceService,
  addressIntelService,
} from '@/lib/services/address/AddressIntelligenceService';
import { PaymentsService } from '@/lib/services/payments/PaymentsService';
import { mapLegacyStatus } from '@/lib/services/statusMapping';
import { TaskService, createTaskWithRoleAssignment } from '@/lib/services/task-service';
import { executeGuards, getGuardErrorMessage } from '@/lib/status-guards';
import { getStatusLabel } from '@/lib/orderStatus';
import { validateTransition } from '@/lib/status-machine';
import { getStoreSettings } from '@/lib/store-settings';
import { TaskLabel } from '@/lib/orders/rules/taskLabelMap';
import {
  OrderStatus,
  PaymentMethod,
  Prisma,
  SerialNumberType,
  TaskPriority,
  TaskType,
  UserRole,
} from '@prisma/client';
import { AuditService } from '@/lib/services/audit/AuditService';
import { AutoPurchaseService, InventoryService } from '@/lib/services/inventory';

interface PendingOrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
  supplierId?: string;
  remarks?: string;
  inventoryEnabled?: boolean;
  procurementRequired?: boolean;
  serialNumberType?: SerialNumberType;
  wasOnSale?: boolean;
  originalPriceCents?: number | null;
}

// Local helpers or specialized internal types can stay, but domain DTOs should favor the centralization

export class OrdersService {
  constructor(
    private ordersRepo: OrdersRepository,
    private customersRepo: CustomersRepository,
    private productsRepo: ProductsRepository,
    private logger: Logger,
    private auditService: AuditService,
    private paymentsService: PaymentsService,
    private addressService: AddressIntelligenceService = addressIntelService,
    private inventoryService?: InventoryService,
    private autoPurchaseService?: AutoPurchaseService
  ) {}

  /**
   * List orders with filters and pagination
   */
  async listOrders(
    filters: OrderListFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<OrderDTO>> {
    this.logger.debug('OrdersService.listOrders', { filters, pagination });

    // Call repository
    const result = await this.ordersRepo.findOrders(filters, pagination);

    // Map to DTOs
    const items = Array.isArray(result?.items) ? result.items : [];
    const dtos = items.map((order) => normalizeOrder(order));

    return {
      items: dtos,
      pagination: {
        total: result?.total ?? items.length,
        hasMore: result?.hasMore ?? false,
        nextCursor: result?.nextCursor,
      },
    };
  }

  /**
   * Get order by ID with full details
   */
  async getOrderById(id: string): Promise<OrderDTO | null> {
    this.logger.debug('OrdersService.getOrderById', { id });

    const order = await this.ordersRepo.findById(id, {
      includeDetails: true,
    });

    return order ? normalizeOrder(order) : null;
  }

  /**
   * Create a new order
   */
  async createOrder(data: OrderCreateInput, userId: string): Promise<OrderDTO> {
    this.logger.info('OrdersService.createOrder', { userId });

    const storeSettings = await getStoreSettings();
    const taxRate = (storeSettings.taxRatePercent ?? 0) / 100;

    // 1. Validate business rules and compute total
    const { normalizedItems, subTotalCents, taxCents, totalCents, customerSnapshot } =
      await this.validateOrderCreation(data, taxRate);

    // 2. Transaction for atomicity - only returns IDs to avoid Prisma proxy issues
    const orderRef = await withTransaction(async (tx) => {
      // 3. Generate order number
      const orderNumber = await this.generateOrderNumber(tx);
      const initialTaskLabel = TaskLabel.VERIFY_ORDER;

      // Separate payment from other data to avoid Prisma validation error
      const { payment } = data;

      const payload: Prisma.OrderCreateInput = {
        number: orderNumber,
        status: 'RECEIVED', // Default initial status
        opsLane: 'NEEDS_ACTION',
        taskLabel: initialTaskLabel,
        opsCurrentTask: initialTaskLabel,
        createdByUser: { connect: { id: userId } },
        customer: { connect: { id: data.customerId } },
        customerName: customerSnapshot.name ?? undefined,
        customerEmail: customerSnapshot.email ?? undefined,
        customerPhone: customerSnapshot.phone ?? undefined,
        billingAddress: { connect: { id: data.billingAddressId } },
        shippingAddress: { connect: { id: data.shippingAddressId } },
        priority: data.priority,
        notes: data.notes,

        currency: storeSettings.defaultCurrency || 'ILS',
        subTotalCents,
        taxCents,
        shippingCents: 0,
        discountCents: 0,
        totalCents,
        items: {
          create: normalizedItems.map((item) => ({
            product: item.productId ? { connect: { id: item.productId } } : undefined,
            sku: item.sku,
            name: item.name,
            qty: item.quantity,
            priceCents: item.priceCents,
            totalCents: item.totalCents,
            supplier: item.supplierId ? { connect: { id: item.supplierId } } : undefined,
            remarks: item.remarks,
            vatCategory: 'STANDARD',
            taxRate: taxRate > 0 ? taxRate : null,
            is_tax_included: true,
            was_on_sale: item.wasOnSale ?? false,
            original_price_cents: item.originalPriceCents ?? null,
          })),
        },
      };

      // 4. Create order - returns minimal { id, customerId, number }
      const created = await this.ordersRepo.createOrder(payload, tx);

      // 5. Log creation in status history for event trail
      await this.ordersRepo.createStatusHistory(
        created.id,
        null,
        'RECEIVED',
        userId,
        'ההזמנה נוצרה',
        undefined, // metadata
        tx
      );

      // 6. Record customer ledger entry
      await this.customersRepo.recordOrderCharge(created.customerId, created.id, totalCents, tx);

      // 7. Create payment if provided
      if (payment) {
        await tx.payment.create({
          data: {
            orderId: created.id,
            method: mapPaymentMethod(payment.method),
            amountCents: payment.amountCents || 0,
            status: payment.status || 'PENDING',
            paymentDate: new Date(),
          },
        });

        // Update order payment tracking
        await tx.order.update({
          where: { id: created.id },
          data: {
            paidAmountCents: payment.status === 'PAID' ? payment.amountCents : 0,
            paymentStatus: payment.status,
            lastPaymentAt: payment.status === 'PAID' ? new Date() : null,
          },
        });
      }

      // Return only the reference - full order will be fetched after transaction commits
      return { id: created.id, customerId: created.customerId };
    });

    // 8. Fetch full order after transaction commits (avoids Prisma proxy issues)
    const order = await this.ordersRepo.getOrderWithIncludes(orderRef.id);
    if (!order) {
      throw new Error(`Order ${orderRef.id} not found after creation`);
    }

    // 9. Audit log
    await this.auditService.logCreate('Order', order.id, userId, { id: order.id });

    await this.runAddressNormalization(order.id);

    // 10. Create follow-up task for intake (CALL_BACK) if needed
    const orderDto = normalizeOrder(order);
    this.createAutomationTasks(orderDto, null, 'RECEIVED', userId).catch((err) => {
      this.logger.error('Failed to create automation tasks on order orderDto', err);
    });

    // 11. Trigger side effects (async, non-blocking)
    this.triggerPostCreationActions(order.id).catch((err) => {
      this.logger.error('Post-creation actions failed', err);
    });

    import('@/lib/push/webPush')
      .then(({ notifyNewOrderWebPush }) =>
        notifyNewOrderWebPush({
          orderId: order.id,
          orderNumber: orderDto.number,
          customerName: orderDto.customerName ?? null,
        })
      )
      .catch((err) => {
        this.logger.warn('Web push new-order notify skipped', err);
      });

    // 12. Sync to Redis (Unified Data Module)
    this.syncOrderToRedis(order.id).catch((err) => {
      this.logger.error('Redis sync failed', err);
    });

    // 13. Auto inventory check and PO creation (async, non-blocking)
    this.handleInventoryAutomation(order.id, userId).catch((err) => {
      this.logger.error('Inventory automation failed', err);
    });

    // 14. Return DTO
    return orderDto;
  }

  /**
   * Update order
   */
  async updateOrder(id: string, data: OrderUpdateInput, userId: string): Promise<OrderDTO> {
    this.logger.info('OrdersService.updateOrder', { id, userId });

    // 1. Get current state for audit
    const current = await this.ordersRepo.findById(id);
    if (!current) throw new NotFoundError('Order not found');

    if ('status' in data && (data as { status?: string }).status !== current.status) {
      throw new ValidationError('שינוי סטטוס דורש את פעולת המעבר הייעודית');
    }

    // 2. Map DTO to Prisma input (Convert shekels to cents)
    const prismaData: any = { ...data };

    if (data.subTotal !== undefined) {
      prismaData.subTotalCents = Math.round(data.subTotal * 100);
      delete prismaData.subTotal;
    }
    if (data.tax !== undefined) {
      prismaData.taxCents = Math.round(data.tax * 100);
      delete prismaData.tax;
    }
    if (data.shipping !== undefined) {
      prismaData.shippingCents = Math.round(data.shipping * 100);
      delete prismaData.shipping;
    }
    if (data.discount !== undefined) {
      prismaData.discountCents = Math.round(data.discount * 100);
      delete prismaData.discount;
    }
    if (data.totalAmount !== undefined) {
      prismaData.totalCents = Math.round(data.totalAmount * 100);
      delete prismaData.totalAmount;
    }

    if (data.labels) {
      prismaData.labels = {
        set: data.labels.map((id) => ({ id })),
      };
    }

    const updated = await this.ordersRepo.updateOrder(id, prismaData);

    // 3. Audit log
    await this.auditService.logUpdate('Order', id, userId, current, updated);

    // 4. Redis Sync. Setting a date does not move the status: leaving for delivery
    // or installation is an explicit transition that requires the date.
    await this.syncOrderToRedis(id);

    return normalizeOrder(updated);
  }

  /**
   * Change order status with validation
   */
  async changeOrderStatus(
    orderId: string,
    input: OrderStatusChangeInput,
    userId: string
  ): Promise<OrderDTO> {
    this.logger.info('OrdersService.changeOrderStatus', {
      orderId,
      newStatus: input.newStatus,
      userId,
      metadata: input.metadata,
    });

    // 1. Get current order
    const order = await this.ordersRepo.findById(orderId, { includeDetails: true });
    if (!order) throw new NotFoundError('Order not found');

    // 2. Validate transition
    const validation = validateTransition(order.status, input.newStatus);
    if (!validation.allowed) {
      throw new ValidationError(
        `לא ניתן לעבור מ"${getStatusLabel(order.status)}" ל"${getStatusLabel(input.newStatus)}"`,
        {
          currentStatus: order.status,
          targetStatus: input.newStatus,
          allowedTargets: validation.allowedTargets,
        }
      );
    }

    // A held order resumes only to the status it was held from (or is cancelled).
    if (order.status === 'ON_HOLD' && input.newStatus !== 'CANCELLED') {
      const history = await this.ordersRepo.getStatusHistory(orderId);
      const heldFrom = history.find((entry) => entry.toStatus === 'ON_HOLD')?.fromStatus;
      if (heldFrom && heldFrom !== input.newStatus) {
        throw new ValidationError(
          `הזמנה מושהית חוזרת רק לשלב שבו הושהתה: "${getStatusLabel(heldFrom)}"`,
          { currentStatus: order.status, targetStatus: input.newStatus, resumeStatus: heldFrom }
        );
      }
    }

    // 3. Execute guards
    const guardResult = executeGuards(order, input.newStatus, {
      currentStatus: order.status,
      additionalData: { reason: input.reason },
    });
    if (!guardResult.allPassed) {
      throw new ValidationError(getGuardErrorMessage(guardResult), {
        currentStatus: order.status,
        targetStatus: input.newStatus,
        missingRequirements: guardResult.blockingFailures,
      });
    }

    // 4. Update status + create history in transaction
    const updated = await withTransaction(async (tx) => {
      const updated = await this.ordersRepo.updateStatus(orderId, input.newStatus, tx);

      // Clear labels on status change
      await tx.order.update({
        where: { id: orderId },
        data: {
          labels: {
            set: [],
          },
        },
      });

      await this.ordersRepo.createStatusHistory(
        orderId,
        order.status,
        input.newStatus,
        userId,
        input.reason,
        input.metadata,
        tx
      );

      // --- DUAL WRITE (V2) ---
      if (process.env.DUAL_WRITE === 'true') {
        try {
          const mapped = mapLegacyStatus(input.newStatus);
          await tx.order.update({
            where: { id: orderId },
            data: {
              statusV2: mapped.statusV2,
              isDraft: mapped.isDraft,
              onHold: mapped.onHold,
              inventoryStatus: mapped.inventoryStatus,
              completionType: mapped.completionType,
              statusUpdatedAt: new Date(),
            },
          });
        } catch (err) {
          this.logger.error('Dual-write failed during status update', {
            orderId,
            newStatus: input.newStatus,
            userId,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          throw err;
        }
      }
      // -----------------------

      return updated;
    });

    // 5. Audit log
    const updatedDto = normalizeOrder(updated);
    await this.auditService.logOrderStatusChange(
      orderId,
      order.status,
      input.newStatus,
      userId,
      input.reason
    );

    // 6. Trigger automation (async)
    this.createAutomationTasks(updatedDto, order.status, input.newStatus, userId).catch((err) => {
      this.logger.error('Automation task creation failed', err);
    });

    this.triggerStatusAutomation(orderId, input.newStatus).catch((err) => {
      this.logger.error('Status automation failed', err);
    });

    // 7. Redis Sync
    await this.syncOrderToRedis(orderId);

    return normalizeOrder(updated);
  }

  /**
   * Add payment to order
   */
  async addPayment(
    orderId: string,
    payment: PaymentCreateInput,
    userId: string
  ): Promise<OrderDTO> {
    this.logger.info('OrdersService.addPayment', { orderId, amount: payment.amountCents });

    // Delegate to PaymentsService, then refresh order
    await this.paymentsService.createPayment({ ...payment, orderId }, userId);

    const updated = await this.ordersRepo.findById(orderId);

    // Redis Sync
    if (updated) await this.syncOrderToRedis(orderId);

    return normalizeOrder(updated!);
  }

  async getOrderStatusHistory(orderId: string) {
    this.logger.debug('OrdersService.getOrderStatusHistory', { orderId });
    return this.ordersRepo.getStatusHistory(orderId);
  }

  /**
   * Set order on hold
   */
  async holdOrder(id: string, reason: string, userId: string): Promise<OrderDTO> {
    return this.changeOrderStatus(id, { newStatus: 'ON_HOLD', reason }, userId);
  }

  /**
   * Resume a held order to the status it was held from
   */
  async unholdOrder(id: string, userId: string): Promise<OrderDTO> {
    const order = await this.ordersRepo.findById(id);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'ON_HOLD') throw new ValidationError('ההזמנה אינה מושהית');

    const history = await this.ordersRepo.getStatusHistory(id);
    const heldFrom = history.find((entry) => entry.toStatus === 'ON_HOLD')?.fromStatus;
    if (!heldFrom) throw new ValidationError('לא נמצא השלב שממנו ההזמנה הושהתה');

    return this.changeOrderStatus(id, { newStatus: heldFrom as OrderStatus, reason: 'המשך טיפול' }, userId);
  }

  /**
   * Update order items (e.g. received status)
   */
  async updateOrderItems(
    orderId: string,
    items: { id: string; received?: boolean }[],
    userId: string
  ): Promise<OrderDTO> {
    this.logger.info('OrdersService.updateOrderItems', { orderId, itemCount: items.length });

    const { getPrismaClient } = await import('@/lib/db');
    const prisma = getPrismaClient();

    await withTransaction(async (tx) => {
      // Validate order exists
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError('Order not found');

      // Update each item
      for (const item of items) {
        if (item.received !== undefined) {
          await tx.orderItem.update({
            where: { id: item.id, orderId }, // Ensure item belongs to order
            data: { received: item.received },
          });
        }
      }

      // Audit log (generic update for now)
      await this.auditService.logUpdate(
        'Order',
        orderId,
        userId,
        { action: 'update_items' },
        { items }
      );
    });

    const updated = await this.ordersRepo.findById(orderId);
    if (updated) await this.syncOrderToRedis(orderId);

    return normalizeOrder(updated!);
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('OrdersService.delete', { id, userId });

    const order = await this.ordersRepo.findById(id);
    if (!order) throw new NotFoundError('Order not found');

    await this.ordersRepo.softDelete(id);
    await this.auditService.logDelete('Order', id, userId);
  }

  /**
   * Update Ops Board status/lane
   */
  async updateOpsStatus(
    id: string,
    opsLane: string,
    opsStatus: string | null,
    userId: string
  ): Promise<OrderDTO> {
    const { getPrismaClient } = await import('@/lib/db');
    const prisma = getPrismaClient();

    const normalizedLane =
      opsLane === 'needs' ? 'needs' : opsLane === 'waiting' ? 'waiting' : 'scheduled';

    // Validate if scheduled lane requires scheduledAt?
    // For now, flexible.

    const updated = await prisma.order.update({
      where: { id },
      data: {
        opsLane: normalizedLane,
        opsStatus,
      },
      include: {
        customer: true, // We need basic includes to return DTO
        billingAddress: true,
        shippingAddress: true,
        items: true,
      },
    });

    // Log?

    return normalizeOrder(updated as any);
  }

  /**
   * Update Checklist State
   */
  async updateChecklist(id: string, checklistState: any, userId: string): Promise<OrderDTO> {
    const { getPrismaClient } = await import('@/lib/db');
    const prisma = getPrismaClient();

    const updated = await prisma.order.update({
      where: { id },
      data: {
        checklistState,
      },
      include: {
        customer: true,
        billingAddress: true,
        shippingAddress: true,
        items: true,
      },
    });

    return normalizeOrder(updated as any);
  }

  // Private helper methods
  private async validateOrderCreation(
    data: OrderCreateInput,
    taxRate: number
  ): Promise<{
    normalizedItems: PendingOrderItem[];
    subTotalCents: number;
    taxCents: number;
    totalCents: number;
    customerSnapshot: {
      name: string | null;
      email: string | null;
      phone: string | null;
    };
  }> {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new ValidationError('Order must include at least one item');
    }

    if (!data.customerId) {
      throw new ValidationError('Customer is required');
    }

    // Validate addresses exist and belong to the customer
    const { getPrismaClient } = await import('@/lib/db');
    const prisma = getPrismaClient();

    // If addresses not provided, auto-fetch from customer
    let billingAddressId = data.billingAddressId;
    let shippingAddressId = data.shippingAddressId;

    if (!billingAddressId || !shippingAddressId) {
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
        include: { addresses: true },
      });

      if (!customer) {
        throw new ValidationError('Customer not found');
      }

      if (!billingAddressId) {
        const billingAddr = customer.addresses.find((a) => a.type === 'BILLING');
        if (!billingAddr) {
          throw new ValidationError('Customer has no billing address');
        }
        billingAddressId = billingAddr.id;
        (data as any).billingAddressId = billingAddressId;
      }

      if (!shippingAddressId) {
        const shippingAddr =
          customer.addresses.find((a) => a.type === 'SHIPPING') ||
          customer.addresses.find((a) => a.type === 'BILLING');
        if (!shippingAddr) {
          throw new ValidationError('Customer has no shipping address');
        }
        shippingAddressId = shippingAddr.id;
        (data as any).shippingAddressId = shippingAddressId;
      }
    }

    const [billingAddress, shippingAddress] = await Promise.all([
      prisma.address.findUnique({
        where: { id: billingAddressId },
        select: { id: true, customerId: true },
      }),
      prisma.address.findUnique({
        where: { id: shippingAddressId },
        select: { id: true, customerId: true },
      }),
    ]);

    if (!billingAddress) {
      throw new ValidationError('Billing address not found');
    }

    if (!shippingAddress) {
      throw new ValidationError('Shipping address not found');
    }

    if (billingAddress.customerId !== data.customerId) {
      throw new ValidationError('Billing address does not belong to this customer');
    }

    if (shippingAddress.customerId !== data.customerId) {
      throw new ValidationError('Shipping address does not belong to this customer');
    }

    const normalizedItems: PendingOrderItem[] = [];

    // Validate and normalize items
    for (const item of data.items) {
      const quantity = Number(item.quantity);
      const pricePerUnit = Number(item.pricePerUnit);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new ValidationError('Item quantity must be a positive number');
      }

      if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
        throw new ValidationError('Item price must be zero or positive');
      }

      // Try to find product by ID first - using direct prisma access to avoid dynamic model accessor issue
      const prisma = getPrismaClient();
      let product: any = null;

      if (item.productId) {
        product = await prisma.product.findUnique({
          where: { id: item.productId },
        });
      }

      // If not found and we have SKU info, try to find or create by SKU
      if (!product && item.sku) {
        this.logger.info('Product not found by ID, attempting find or create by SKU', {
          productId: item.productId,
          sku: item.sku,
        });

        // Calculate price in cents from pricePerUnit
        const basePriceCents = Math.round(pricePerUnit * 100);

        product = await this.productsRepo.findOrCreateBySku(
          item.sku,
          item.name || item.sku,
          basePriceCents,
          {
            inventoryEnabled: (item as any).inventoryEnabled,
            procurementRequired: (item as any).procurementRequired,
            serialNumberType: (item as any).serialNumberType,
          }
        );

        // Update item.productId to the found/created product ID
        item.productId = product!.id;
      } else if (!product && !item.productId && item.name) {
        // [FLEXIBLE PROCUREMENT] Handle Ad-Hoc / Custom Item with Manual Name
        this.logger.info('Creating Ad-Hoc Product for custom item', { name: item.name });

        // Generate a temporary SKU if none provided
        const tempSku = `ADHOC-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const basePriceCents = Math.round(pricePerUnit * 100);

        // Create a new product as "Draft" or just standard product with flag?
        // Utilizing existing findOrCreateBySku logic but ensuring it creates new
        product = await this.productsRepo.findOrCreateBySku(tempSku, item.name, basePriceCents, {
          inventoryEnabled: (item as any).inventoryEnabled,
          procurementRequired: (item as any).procurementRequired,
          serialNumberType: (item as any).serialNumberType,
        });

        if (product) {
          item.productId = product.id;
        } else {
          throw new ValidationError(`Failed to create ad-hoc product for ${item.name}`);
        }
      } else if (!product) {
        // No product ID, no SKU, and no Name - cannot proceed
        throw new ValidationError(
          `Product ${item.productId} not found and insufficient data to create custom item`
        );
      }

      // Convert price from shekels (validator output) back to cents (storage format)
      // Example: pricePerUnit = 100.00 ILS → priceCents = 10000 cents
      let priceCents = Math.round(pricePerUnit * 100);
      let wasOnSale = false;
      let originalPriceCents: number | null = null;

      // If price is zero or matches base price, try effective price from product promo
      if (product && (priceCents === 0 || priceCents === (product.basePriceCents ?? 0))) {
        const effective = getEffectivePrice({
          basePriceCents: product.basePriceCents,
          salePriceCents: product.salePriceCents ?? null,
          promoStartsAt: product.promoStartsAt ?? null,
          promoEndsAt: product.promoEndsAt ?? null,
        });
        if (priceCents === 0) {
          priceCents = effective.priceCents;
        }
        wasOnSale = effective.wasOnSale;
        originalPriceCents = effective.originalPriceCents;
      }

      const totalCents = priceCents * quantity;

      // Validate supplier if provided
      if (item.supplierId) {
        const supplierExists = await prisma.supplier.findUnique({
          where: { id: item.supplierId },
          select: { id: true },
        });

        if (!supplierExists) {
          throw new ValidationError(`Supplier ${item.supplierId} not found`);
        }
      }

      normalizedItems.push({
        productId: item.productId as string,
        sku: product?.sku ?? item.sku ?? (item.productId as string) ?? 'UNKNOWN',
        name: item.name || product?.name || item.sku || 'Unknown product',
        quantity,
        priceCents,
        totalCents,
        supplierId: item.supplierId,
        remarks: item.remarks,
        inventoryEnabled: (item as any).inventoryEnabled,
        procurementRequired: (item as any).procurementRequired,
        serialNumberType: (item as any).serialNumberType,
        wasOnSale,
        originalPriceCents,
      });
    }

    // Tax-inclusive pricing: prices already include VAT
    // Extract the VAT component from the total rather than adding on top
    const totalCents = normalizedItems.reduce((sum, item) => sum + item.totalCents, 0);
    const taxCents = taxRate > 0 ? Math.round(totalCents - totalCents / (1 + taxRate)) : 0;
    const subTotalCents = totalCents - taxCents; // Subtotal = Net amount (Total - Tax)

    // Check customer exists and has credit
    const customer = await this.customersRepo.findById(data.customerId);
    if (!customer) throw new ValidationError('Customer not found');

    if (
      typeof customer.creditLimitCents === 'number' &&
      (customer.currentBalanceCents ?? 0) + totalCents > customer.creditLimitCents
    ) {
      throw new ValidationError('Customer credit limit exceeded');
    }

    const customerSnapshot = {
      name: customer.name?.trim() || null,
      email: customer.email?.trim() || null,
      phone: customer.phone?.trim() || null,
    };

    return { normalizedItems, subTotalCents, taxCents, totalCents, customerSnapshot };
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    const lastOrder = await tx.order.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    });

    if (!lastOrder) return `${prefix}0001`;

    const lastNum = parseInt(lastOrder.number.split('-')[2]);
    const nextNum = (lastNum + 1).toString().padStart(4, '0');
    return `${prefix}${nextNum}`;
  }

  private async runAddressNormalization(orderId: string) {
    try {
      await this.addressService.normalizeOrderAddress(orderId);
    } catch (error) {
      this.logger.warn('Address normalization skipped due to error', { orderId, error });
    }
  }

  /**
   * Create automated tasks based on status transitions and role assignment rules.
   * Uses existing TaskService and dedup logic (OPEN tasks per order/type).
   */
  private async createAutomationTasks(
    order: OrderDTO,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    userId: string
  ): Promise<void> {
    // Helpers
    const allItemsReceived = Array.isArray(order?.items)
      ? order.items.every((item: any) => item?.received === true)
      : true;

    switch (toStatus) {
      case 'RECEIVED': {
        // Intake follow-up (CALL_BACK) assigned to creator or SALES role
        const targetUser = (order as any).createdByUserId ?? userId;
        await TaskService.createTask({
          orderId: order.id,
          type: TaskType.CALL_BACK,
          priority: TaskPriority.HIGH,
          assigneeId: targetUser,
          notes: 'בדיקת פרטי לקוח/תשלום להזמנה חדשה',
        });
        break;
      }
      case 'PROCESSING': {
        // Stock receipt task?
        if (!allItemsReceived) {
          await createTaskWithRoleAssignment(
            {
              orderId: order.id,
              type: TaskType.STOCK_RECEIPT,
              priority: TaskPriority.HIGH,
              notes: 'קליטת סחורה / מעקב רכש',
            },
            UserRole.PURCHASING
          );
        }
        break;
      }
      case 'READY': {
        //If no schedule or assignee, create scheduling task for OPS
        if (!order?.scheduledAt || !order?.assignedUser?.id) {
          await createTaskWithRoleAssignment(
            {
              orderId: order.id,
              type: TaskType.INSTALL_REMINDER,
              priority: TaskPriority.MEDIUM,
              notes: 'קביעת מועד והקצאת מתקין להזמנה מוכנה להתקנה',
            },
            UserRole.OPERATIONS
          );
        }
        break;
      }
      case 'INSTALLATION': {
        // Reminder task for assigned installer before visit
        const visitDate: Date | null = order?.scheduledAt ? new Date(order.scheduledAt) : null;
        const dueAt =
          visitDate && !Number.isNaN(visitDate.getTime())
            ? new Date(visitDate.getTime() - 24 * 60 * 60 * 1000)
            : undefined;
        await TaskService.createTask({
          orderId: order.id,
          type: TaskType.INSTALL_REMINDER,
          priority: TaskPriority.MEDIUM,
          assigneeId: order.assignedUser?.id,
          dueAt,
          notes: 'תזכורת לפני ביקור / התקנה',
        });
        break;
      }
      case 'COMPLETED': {
        // Close open install reminder tasks and stock tasks
        await TaskService.completeTasksForOrder(order.id, TaskType.INSTALL_REMINDER);
        await TaskService.completeTasksForOrder(order.id, TaskType.STOCK_RECEIPT);
        break;
      }
      default:
        break;
    }
  }

  private async triggerPostCreationActions(orderId: string): Promise<void> {
    if (isTenantRuntime()) return;
    // Check if order has items requiring procurement and create OpsAction
    try {
      const { createPurchaseApprovalAction } = await import('@/lib/services/ops-action-service');
      const result = await createPurchaseApprovalAction(orderId);
      if (result.messageText) {
        this.logger.info('OpsAction created for purchase approval', {
          orderId,
          actionId: result.actionId,
        });
        // messageText is available for n8n webhook integration
      }
    } catch (err) {
      this.logger.error('Failed to create purchase approval OpsAction', err);
    }
  }

  private async triggerStatusAutomation(orderId: string, newStatus: OrderStatus): Promise<void> {
    // Trigger workflow automation
    // Send notifications
    // Update calendar events
    // etc.
  }

  /**
   * Helper to sync a full order to Redis using the Unified Object Model
   */
  private async syncOrderToRedis(orderId: string): Promise<void> {
    try {
      const { getPrismaClient } = await import('@/lib/db');
      const prisma = getPrismaClient();

      const fullOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: UNIFIED_ORDER_INCLUDE,
      });

      if (fullOrder) {
        const unified = mapOrderToUnified(fullOrder);
        await upsertUnifiedOrder(unified);
        this.logger.debug(`Synced order ${orderId} to Redis`);
      }
    } catch (error) {
      this.logger.warn(`Failed to sync order ${orderId} to Redis`, { error });
      // Don't throw, we don't want to break the main flow
    }
  }

  /**
   * Handle automatic inventory checking and purchase order creation
   */
  private async handleInventoryAutomation(orderId: string, userId: string): Promise<void> {
    if (isTenantRuntime()) return;
    if (!this.inventoryService || !this.autoPurchaseService) {
      this.logger.debug('Inventory services not configured, skipping automation');
      return;
    }

    try {
      // Check inventory availability
      const inventoryCheck = await this.inventoryService.checkOrderInventory(orderId);

      if (inventoryCheck.allAvailable) {
        // All inventory available - move directly to scheduling
        this.logger.info('All inventory available, moving to READY', { orderId });

        await this.changeOrderStatus(
          orderId,
          {
            newStatus: 'READY',
            reason: 'System: All inventory available',
          },
          'SYSTEM'
        );
      } else if (inventoryCheck.needsPurchase && inventoryCheck.missingItems.length > 0) {
        // Need to create purchase orders
        this.logger.info('Creating purchase orders for missing inventory', {
          orderId,
          missingItemsCount: inventoryCheck.missingItems.length,
        });

        const poIds = await this.autoPurchaseService.createPurchaseOrdersForOrder(
          orderId,
          inventoryCheck.missingItems,
          userId
        );

        if (poIds.length > 0) {
          await this.changeOrderStatus(
            orderId,
            {
              newStatus: 'PROCESSING',
              reason: `System: Created ${poIds.length} purchase order(s) automatically`,
            },
            'SYSTEM'
          );

          // Then move to PROCESSING
          await this.changeOrderStatus(
            orderId,
            {
              newStatus: 'PROCESSING',
              reason: 'System: Waiting for stock from purchase orders',
            },
            'SYSTEM'
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to handle inventory automation', error as Error, { orderId });
      // Don't throw - this is a background process
    }
  }
}

function mapPaymentMethod(method: string | undefined | null): PaymentMethod {
  if (method == null || method === '') return 'OTHER';
  const mapping: Record<string, PaymentMethod> = {
    'העברה בנקאית': PaymentMethod.BANK_TRANSFER,
    bank_transfer: PaymentMethod.BANK_TRANSFER,
    'Bank Transfer': PaymentMethod.BANK_TRANSFER,
    מזומן: PaymentMethod.CASH,
    cash: PaymentMethod.CASH,
    Cash: PaymentMethod.CASH,
    "צ'ק": PaymentMethod.CHECK,
    check: PaymentMethod.CHECK,
    Check: PaymentMethod.CHECK,
    Cheque: PaymentMethod.CHECK,
    'כרטיס אשראי': PaymentMethod.CREDIT_CARD,
    credit_card: PaymentMethod.CREDIT_CARD,
    'Credit Card': PaymentMethod.CREDIT_CARD,
    ביט: PaymentMethod.BIT,
    bit: PaymentMethod.BIT,
    Bit: PaymentMethod.BIT,
    'Bit app': PaymentMethod.BIT,
  };

  const mapped = mapping[method] ?? mapping[method.toLowerCase()];
  if (mapped) return mapped;

  // If it matches an enum key directly, return it
  const validEnums = [
    'CASH',
    'CHECK',
    'BANK_TRANSFER',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'BIT',
    'PAYPAL',
    'STRIPE',
    'OTHER',
  ];
  if (validEnums.includes(method)) return method as PaymentMethod;

  return 'OTHER';
}

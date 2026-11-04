import { ApiError } from '@/lib/api-middleware';

// Re-export base errors for consumers that expect them from this module
export { NotFoundError, ValidationError } from '@/lib/api-middleware';

// Orders
export class OrderNotFoundError extends ApiError {
  constructor(orderId: string) {
    super('ORDER_NOT_FOUND', `Order ${orderId} not found`, 404, { orderId });
  }
}

export class OrderStatusTransitionError extends ApiError {
  constructor(fromStatus: string, toStatus: string, reason: string) {
    super(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition from ${fromStatus} to ${toStatus}: ${reason}`,
      400,
      { fromStatus, toStatus, reason }
    );
  }
}

// Customers
export class CustomerNotFoundError extends ApiError {
  constructor(customerId: string) {
    super('CUSTOMER_NOT_FOUND', `Customer ${customerId} not found`, 404, { customerId });
  }
}

export class CreditLimitExceededError extends ApiError {
  constructor(customerId: string, requestedAmount: number, availableCredit: number) {
    super('CREDIT_LIMIT_EXCEEDED', `Credit limit exceeded for customer ${customerId}`, 400, {
      customerId,
      requestedAmount,
      availableCredit,
    });
  }
}

// Products/Inventory
export class ProductNotFoundError extends ApiError {
  constructor(productId: string) {
    super('PRODUCT_NOT_FOUND', `Product ${productId} not found`, 404, { productId });
  }
}

export class InsufficientStockError extends ApiError {
  constructor(productId: string, requested: number, available: number) {
    super('INSUFFICIENT_STOCK', `Insufficient stock for Product ${productId}`, 400, {
      productId,
      requested,
      available,
    });
  }
}

// Suppliers
export class SupplierNotFoundError extends ApiError {
  constructor(supplierId: string) {
    super('SUPPLIER_NOT_FOUND', `Supplier ${supplierId} not found`, 404, { supplierId });
  }
}

// Payments
export class PaymentNotFoundError extends ApiError {
  constructor(paymentId: string) {
    super('PAYMENT_NOT_FOUND', `Payment ${paymentId} not found`, 404, { paymentId });
  }
}

export class PaymentAlreadyRefundedError extends ApiError {
  constructor(paymentId: string) {
    super('PAYMENT_ALREADY_REFUNDED', `Payment ${paymentId} already refunded`, 400, { paymentId });
  }
}

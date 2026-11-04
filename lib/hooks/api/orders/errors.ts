export class OrdersApiError extends Error {
  code?: string;
  status?: number;
  details?: unknown;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
      details?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'OrdersApiError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

type ErrorShape = {
  message?: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export function toOrdersApiError(
  error: unknown,
  fallbackMessage = 'Failed to fetch order data'
): OrdersApiError {
  if (error instanceof OrdersApiError) {
    return error;
  }

  if (error && typeof error === 'object') {
    const shape = error as ErrorShape;
    return new OrdersApiError(shape.message || fallbackMessage, {
      code: shape.code,
      status: shape.status,
      details: shape.details,
    });
  }

  if (error instanceof Error) {
    return new OrdersApiError(error.message || fallbackMessage);
  }

  return new OrdersApiError(fallbackMessage);
}

export function isOrdersApiError(error: unknown): error is OrdersApiError {
  return error instanceof OrdersApiError;
}

export function isNotFoundOrdersError(error: unknown): boolean {
  if (!isOrdersApiError(error)) return false;

  if (error.status === 404) return true;
  if (!error.code) return false;

  const normalizedCode = error.code.toLowerCase();
  return normalizedCode === 'not_found' || normalizedCode === 'order_not_found';
}

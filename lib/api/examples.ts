/**
 * API Usage Examples
 *
 * This file demonstrates how to use the new API services directly
 * (outside React components or when you need more control).
 *
 * Key features demonstrated:
 * - Direct API service calls
 * - Error handling with correlation IDs
 * - Type-safe responses
 * - Proper success/error checking
 *
 * @module lib/api/examples
 */

import { api, ordersApi, customersApi, productsApi, setLogoutHandler } from '@/lib/api/services';
import type { CreateOrderRequest, OrderStatus } from '@/lib/api/types';

/**
 * Example 1: Fetching Orders with Filters
 *
 * Shows how to:
 * - Use filter parameters
 * - Handle paginated responses
 * - Check for errors with correlation IDs
 */
export async function fetchOrdersExample() {
  const result = await ordersApi.list({
    status: 'TO_DO',
    page: 1,
    limit: 20,
    city: 'Tel Aviv',
  });

  if (!result.success) {
    console.error('Failed to fetch orders:', {
      message: result.error.message,
      code: result.error.code,
      correlationId: result.correlationId, // Use this for debugging
    });
    return;
  }

  // TypeScript knows result.data is PaginatedResponseEnvelope<OrderWithRelations>
  const { data: orders, pagination } = result.data;

  console.log(`Found ${orders.length} orders`);
  console.log(`Total: ${pagination.total}, Page: ${pagination.page}/${pagination.totalPages}`);

  return orders;
}

/**
 * Example 2: Creating an Order
 *
 * Shows how to:
 * - Validate input data
 * - Handle creation errors
 * - Work with the created order
 */
export async function createOrderExample() {
  const orderData: CreateOrderRequest = {
    customerId: 'customer-uuid',
    billingAddressId: 'billing-address-uuid',
    shippingAddressId: 'shipping-address-uuid',
    items: [
      {
        productId: 'product-uuid-1',
        qty: 2,
      },
      {
        productId: 'product-uuid-2',
        qty: 1,
      },
    ],
    notes: 'Customer requested express delivery',
    notesInternal: 'Check stock availability before confirming',
    createdByUserId: 'user-uuid',
  };

  const result = await ordersApi.create(orderData);

  if (!result.success) {
    console.error('Order creation failed:', {
      message: result.error.message,
      details: result.error.details,
      correlationId: result.correlationId,
    });
    return;
  }

  // TypeScript knows result.data is OrderWithRelations
  const order = result.data;

  console.log(`Order created successfully: #${order.number}`);
  console.log(`Order ID: ${order.id}`);
  console.log(`Total: ${(order.totalCents ?? 0) / 100} ILS`);
  console.log(`Correlation ID: ${result.correlationId}`);

  return order;
}

/**
 * Example 3: Updating Order Status
 *
 * Shows how to:
 * - Change order status with reason
 * - Handle business rule violations
 * - Get updated order data
 */
export async function changeOrderStatusExample(orderId: string) {
  const result = await ordersApi.changeStatus(
    orderId,
    'PO_CREATED',
    'Supplier confirmed availability'
  );

  if (!result.success) {
    if (result.error.code === 'INVALID_TRANSITION') {
      console.error('Invalid status transition:', result.error.message);
      // Show user-friendly error
      return;
    }

    console.error('Failed to change status:', {
      message: result.error.message,
      correlationId: result.correlationId,
    });
    return;
  }

  const updatedOrder = result.data;

  console.log(`Status changed to: ${updatedOrder.status}`);
  console.log(`Status history entries: ${(updatedOrder as any).statusHistory?.length || 0}`);

  return updatedOrder;
}

/**
 * Example 4: Fetching Single Order with Relations
 *
 * Shows how to:
 * - Get order with all relations loaded
 * - Access nested data safely
 */
export async function fetchOrderDetailsExample(orderId: string) {
  const result = await ordersApi.get(orderId);

  if (!result.success) {
    console.error('Failed to fetch order:', result.error.message);
    return;
  }

  const order = result.data;

  // Access relations (TypeScript knows they're optional)
  console.log('Customer:', order.customer?.name || 'N/A');
  console.log('Items:', order.items?.length || 0);
  console.log('Billing Address:', order.billingAddress?.city || 'N/A');
  console.log('Shipping Address:', order.shippingAddress?.city || 'N/A');
  console.log('Payments:', order.payments?.length || 0);
  console.log('Status History:', (order as any).statusHistory?.length || 0);

  return order;
}

/**
 * Example 5: Searching Products
 *
 * Shows how to:
 * - Use search functionality
 * - Handle empty results
 */
export async function searchProductsExample(query: string) {
  const result = await productsApi.search(query);

  if (!result.success) {
    console.error('Search failed:', result.error.message);
    return [];
  }

  const products = result.data;

  if (products.length === 0) {
    console.log(`No products found for: "${query}"`);
    return [];
  }

  console.log(`Found ${products.length} products:`);
  products.forEach((product) => {
    console.log(`- ${product.name} (${product.sku})`);
  });

  return products;
}

/**
 * Example 6: Fetching Customer with Orders
 *
 * Shows how to:
 * - Get customer data
 * - Access customer's order history
 */
export async function fetchCustomerWithOrdersExample(customerId: string) {
  const customerResult = await customersApi.get(customerId);

  if (!customerResult.success) {
    console.error('Failed to fetch customer:', customerResult.error.message);
    return;
  }

  const customer = customerResult.data;

  console.log('Customer:', customer.name);
  console.log('Email:', customer.email || 'N/A');
  console.log('Phone:', customer.phone || 'N/A');
  console.log('Credit Limit:', (customer.creditLimitCents ?? 0) / 100, 'ILS');
  console.log('Current Balance:', (customer.currentBalanceCents ?? 0) / 100, 'ILS');

  // Fetch customer's orders
  const ordersResult = await customersApi.getOrders(customerId);

  if (!ordersResult.success) {
    console.error('Failed to fetch orders:', ordersResult.error.message);
    return;
  }

  const { data: orders, pagination } = ordersResult.data;

  console.log(`Customer has ${pagination.total} orders`);

  return { customer, orders };
}

/**
 * Example 7: Error Handling with Retry Logic
 *
 * Shows how to:
 * - Implement retry logic
 * - Handle different error types
 * - Log correlation IDs for debugging
 */
export async function fetchWithRetryExample(orderId: string, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`Attempt ${attempt} of ${maxRetries}...`);

    const result = await ordersApi.get(orderId);

    if (result.success) {
      console.log('Success!');
      return result.data;
    }

    // Check error type
    if (result.error.status === 404) {
      console.error('Order not found');
      return null; // Don't retry for 404
    }

    if (result.error.status === 401) {
      console.error('Unauthorized - please login');
      return null; // Don't retry for auth errors
    }

    // Log error for debugging
    console.error(`Attempt ${attempt} failed:`, {
      message: result.error.message,
      code: result.error.code,
      correlationId: result.correlationId,
    });

    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error('Max retries reached');
  return null;
}

/**
 * Example 8: Batch Operations
 *
 * Shows how to:
 * - Perform multiple API calls in parallel
 * - Handle partial failures
 * - Aggregate results
 */
export async function batchFetchOrdersExample(orderIds: string[]) {
  console.log(`Fetching ${orderIds.length} orders in parallel...`);

  const results = await Promise.allSettled(
    orderIds.map((id) => ordersApi.get(id))
  );

  const successful: any[] = [];
  const failed: Array<{ id: string; error: string; correlationId?: string }> = [];

  results.forEach((result, index) => {
    const orderId = orderIds[index];

    if (result.status === 'fulfilled' && result.value.success) {
      successful.push(result.value.data);
    } else if (result.status === 'fulfilled' && !result.value.success) {
      failed.push({
        id: orderId,
        error: result.value.error.message,
        correlationId: result.value.correlationId,
      });
    } else if (result.status === 'rejected') {
      failed.push({
        id: orderId,
        error: result.reason?.message || 'Unknown error',
      });
    }
  });

  console.log(`Success: ${successful.length}, Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.error('Failed fetches:', failed);
  }

  return { successful, failed };
}

/**
 * Example 9: Setting up Logout Handler
 *
 * Shows how to:
 * - Register a custom logout handler
 * - Handle 401 responses globally
 */
export function setupAuthExample() {
  // Register logout handler (typically in your AuthProvider)
  setLogoutHandler(async () => {
    console.log('Logging out user...');

    // Clear local state
    localStorage.clear();
    sessionStorage.clear();

    // Redirect to login
    window.location.href = '/login';
  });

  console.log('Logout handler registered');
}

/**
 * Example 10: Using the Aggregated API Object
 *
 * Shows how to:
 * - Use the unified API export
 * - Access all API services from one place
 */
export async function useAggregatedApiExample() {
  // All APIs are available under the `api` export
  const ordersResult = await api.orders.list({ status: 'TO_DO' });
  const customersResult = await api.customers.list({ search: 'John' });
  const productsResult = await api.products.search('iPhone');
  const dashboardResult = await api.dashboard.getSummary();

  console.log('Orders:', ordersResult.success ? ordersResult.data.data.length : 0);
  console.log('Customers:', customersResult.success ? customersResult.data.length : 0);
  console.log('Products:', productsResult.success ? productsResult.data.length : 0);
  console.log('Dashboard:', dashboardResult.success ? 'loaded' : 'failed');
}

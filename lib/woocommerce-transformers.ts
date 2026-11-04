/**
 * WooCommerce Data Transformation Layer
 * Transforms WooCommerce data structures to OMS schema
 */

import type { OrderStatus } from '@prisma/client';
import { ClientFormData, OrderFormData } from '@/lib/types';
import { WooCustomer, WooOrder } from '@/lib/woocommerce/types';

export interface TransformedOrderItem {
  productId?: string;
  qty: number;
  received: boolean;
  // WooCommerce reference data
  woocommerceProductId: number;
  woocommerceVariationId?: number;
  woocommerceSku?: string;
  name: string;
  price: number;
}

export interface TransformedOrder {
  number: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  totalAmount: number;
  address: string;
  city?: string;
  houseNumber?: string;
  floor?: string;
  note?: string;
  status: OrderStatus;
  installAt?: Date;
  items: TransformedOrderItem[];
  // WooCommerce reference data
  woocommerceId: number;
  woocommerceOrderKey: string;
  woocommerceCustomerId: number;
  woocommerceStatus: WooOrder['status'];
  woocommerceCreatedAt: Date;
  woocommerceModifiedAt: Date;
}

export interface TransformedClient {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
  contactPerson?: string;
  notes?: string;
  // WooCommerce reference data
  woocommerceId: number;
  woocommerceUsername?: string;
  woocommerceRole: string;
  woocommerceCreatedAt: Date;
}

/**
 * Order Status Mapping between WooCommerce and OMS
 */
export class OrderStatusMapper {
  // Map WooCommerce statuses to OMS
  private static readonly WC_TO_OMS_STATUS_MAP: Record<string, OrderStatus> = {
    pending: 'TO_DO',
    processing: 'PO_CREATED',
    'on-hold': 'CALL_BACK',
    completed: 'SUPPLIED',
    cancelled: 'CANCELLED',
    refunded: 'CANCELLED',
    failed: 'TO_DO',
    trash: 'CANCELLED',
  };

  private static readonly OMS_TO_WC_STATUS_MAP: Record<OrderStatus, string> = {
    // Core statuses
    RECEIVED: 'pending',
    PROCESSING: 'processing',
    READY: 'processing',
    IN_TRANSIT: 'processing',
    INSTALLATION: 'processing',
    COMPLETED: 'completed',
    // Legacy statuses
    DRAFT: 'pending',
    TO_DO: 'pending',
    CALL_BACK: 'on-hold',
    PENDING_APPROVAL: 'on-hold',
    CONFIRMED: 'processing',
    PO_CREATED: 'processing',
    AWAITING_STOCK: 'processing',
    PARTIALLY_SUPPLIED: 'processing',
    READY_FOR_INSTALL: 'processing',
    INSTALL_SCHEDULING: 'processing',
    AWAITING_INSTALL: 'processing',
    SCHEDULED: 'processing',
    SUPPLIED: 'completed',
    INVOICED: 'completed',
    INSTALLED: 'completed',
    CLOSED: 'completed',
    ON_HOLD: 'on-hold',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled',
  };

  /**
   * Map WooCommerce status to OMS status
   */
  static mapWooCommerceToOMS(wcStatus: string): OrderStatus {
    return this.WC_TO_OMS_STATUS_MAP[wcStatus] || 'TO_DO';
  }

  /**
   * Map OMS status to WooCommerce status
   */
  static mapOMSToWooCommerce(omsStatus: OrderStatus): string {
    return this.OMS_TO_WC_STATUS_MAP[omsStatus] || 'pending';
  }

  /**
   * Get intelligent status mapping based on order details
   */
  static getIntelligentOMSStatus(wcOrder: WooOrder): OrderStatus {
    const baseStatus = this.mapWooCommerceToOMS(wcOrder.status || 'pending');

    // Apply business logic for more accurate status mapping
    switch (wcOrder.status) {
      case 'processing':
        // If order has been paid and has line items, it's ready for PO
        if (wcOrder.date_paid && wcOrder.line_items && wcOrder.line_items.length > 0) {
          return 'PO_CREATED';
        }
        return 'TO_DO';

      case 'completed':
        // Completed orders are done
        return 'SUPPLIED';

      case 'on-hold':
        // On-hold orders need follow-up
        return 'CALL_BACK';

      default:
        return baseStatus;
    }
  }
}

/**
 * Address utilities for parsing WooCommerce address data
 */
export class AddressTransformer {
  /**
   * Combine address components into a single address string
   */
  static combineAddress(address1?: string, address2?: string): string {
    const parts = [address1, address2].filter(Boolean);
    return parts.join(' ') || 'Address not provided';
  }

  /**
   * Extract house number from address string (basic implementation)
   */
  static extractHouseNumber(address: string): string | undefined {
    // Simple regex to extract leading numbers from address
    const match = address.match(/^(\d+[a-zA-Z]?)\s/);
    return match ? match[1] : undefined;
  }

  /**
   * Clean and format address for consistency
   */
  static cleanAddress(address: string): string {
    return address
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/,\s*,/g, ',') // Remove duplicate commas
      .replace(/^,|,$/g, ''); // Remove leading/trailing commas
  }
}

/**
 * Customer/Client Data Transformer
 */
export class ClientTransformer {
  /**
   * Transform WooCommerce customer to OMS Client format
   */
  static transform(wcCustomer: WooCustomer): TransformedClient {
    if (!wcCustomer.id) throw new Error('Customer ID is required');
    const fullName = `${wcCustomer.first_name} ${wcCustomer.last_name}`.trim();
    const displayName = fullName || wcCustomer.username || `Customer ${wcCustomer.id}`;

    // Use billing address as primary, fallback to shipping
    const primaryEmail = wcCustomer.email || wcCustomer.billing?.email;
    const primaryPhone = wcCustomer.billing?.phone;
    const primaryAddress = wcCustomer.billing?.address_1
      ? AddressTransformer.combineAddress(
          wcCustomer.billing.address_1,
          wcCustomer.billing.address_2
        )
      : wcCustomer.shipping?.address_1
        ? AddressTransformer.combineAddress(
            wcCustomer.shipping.address_1,
            wcCustomer.shipping.address_2
          )
        : undefined;
    const primaryCity = wcCustomer.billing?.city || wcCustomer.shipping?.city;

    // Create comprehensive notes
    const notes = [
      `Imported from WooCommerce (ID: ${wcCustomer.id})`,
      wcCustomer.username ? `Username: ${wcCustomer.username}` : null,
      wcCustomer.role ? `Role: ${wcCustomer.role}` : null,
      wcCustomer.is_paying_customer ? 'Paying customer' : 'Non-paying customer',
    ]
      .filter(Boolean)
      .join('. ');

    return {
      name: displayName,
      email: primaryEmail,
      phone: primaryPhone,
      address: primaryAddress ? AddressTransformer.cleanAddress(primaryAddress) : undefined,
      city: primaryCity,
      taxId: undefined, // WooCommerce doesn't have standard tax ID
      contactPerson: fullName || undefined,
      notes,
      // WooCommerce reference data
      woocommerceId: wcCustomer.id,
      woocommerceUsername: wcCustomer.username || undefined,
      woocommerceRole: wcCustomer.role || 'customer',
      woocommerceCreatedAt: new Date(wcCustomer.date_created || Date.now()),
    };
  }

  /**
   * Convert to OMS ClientFormData format
   */
  static toClientFormData(transformedClient: TransformedClient): ClientFormData {
    return {
      name: transformedClient.name,
      email: transformedClient.email,
      phone: transformedClient.phone,
      address: transformedClient.address,
      city: transformedClient.city,
      taxId: transformedClient.taxId,
      contactPerson: transformedClient.contactPerson,
      notes: transformedClient.notes,
    };
  }
}

/**
 * Order Data Transformer
 */
export class OrderTransformer {
  /**
   * Transform WooCommerce order to OMS Order format
   */
  static transform(wcOrder: WooOrder): TransformedOrder {
    if (!wcOrder.id) throw new Error('Order ID is required');
    if (!wcOrder.billing) throw new Error('Order billing is required');
    if (!wcOrder.line_items) throw new Error('Order line items are required');
    // Extract customer information
    const customerName =
      `${wcOrder.billing.first_name} ${wcOrder.billing.last_name}`.trim() ||
      `Customer ${wcOrder.customer_id}`;

    // Determine primary address (billing preferred, fallback to shipping)
    const primaryAddress = wcOrder.billing?.address_1
      ? AddressTransformer.combineAddress(wcOrder.billing.address_1, wcOrder.billing.address_2)
      : wcOrder.shipping?.address_1
        ? AddressTransformer.combineAddress(wcOrder.shipping.address_1, wcOrder.shipping.address_2)
        : 'Address not provided';

    const primaryCity = wcOrder.billing?.city || wcOrder.shipping?.city;
    const houseNumber = AddressTransformer.extractHouseNumber(primaryAddress);

    // Transform line items
    const transformedItems: TransformedOrderItem[] = (wcOrder.line_items || []).map(
      (item: any) => ({
        productId: undefined, // Will be resolved during sync process
        qty: item.quantity,
        received: wcOrder.status === 'completed', // Auto-mark as received if completed
        woocommerceProductId: item.product_id,
        woocommerceVariationId: item.variation_id || undefined,
        woocommerceSku: item.sku || undefined,
        name: item.name,
        price: item.price,
      })
    );

    // Create comprehensive notes
    const noteComponents = [
      wcOrder.customer_note ? `Customer note: ${wcOrder.customer_note}` : null,
      `WooCommerce Order ID: ${wcOrder.id}`,
      `Order Key: ${wcOrder.order_key}`,
      `Payment Method: ${wcOrder.payment_method_title || wcOrder.payment_method}`,
      wcOrder.transaction_id ? `Transaction ID: ${wcOrder.transaction_id}` : null,
    ].filter(Boolean);

    return {
      number: parseInt(wcOrder.number || '0') || wcOrder.id,
      customerName,
      customerEmail: wcOrder.billing?.email || undefined,
      customerPhone: wcOrder.billing?.phone || undefined,
      totalAmount: parseFloat(wcOrder.total || '0'),
      address: AddressTransformer.cleanAddress(primaryAddress),
      city: primaryCity,
      houseNumber,
      floor: undefined, // Not available in WooCommerce standard fields
      note: noteComponents.join(' | '),
      status: OrderStatusMapper.getIntelligentOMSStatus(wcOrder),
      installAt: wcOrder.date_modified ? new Date(wcOrder.date_modified) : undefined, // fallback if date_completed is missing
      items: transformedItems,
      // WooCommerce reference data
      woocommerceId: wcOrder.id,
      woocommerceOrderKey: wcOrder.order_key || '',
      woocommerceCustomerId: wcOrder.customer_id || 0,
      woocommerceStatus: wcOrder.status || 'pending',
      woocommerceCreatedAt: new Date(wcOrder.date_created || ''),
      woocommerceModifiedAt: new Date(wcOrder.date_modified || ''),
    };
  }

  /**
   * Convert to OMS OrderFormData format
   */
  static toOrderFormData(transformedOrder: TransformedOrder): OrderFormData {
    return {
      customerName: transformedOrder.customerName,
      customerEmail: transformedOrder.customerEmail,
      customerPhone: transformedOrder.customerPhone,
      address: transformedOrder.address,
      city: transformedOrder.city,
      houseNumber: transformedOrder.houseNumber,
      floor: transformedOrder.floor,
      note: transformedOrder.note,
      totalAmount: transformedOrder.totalAmount,
      items: transformedOrder.items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
      })),
    };
  }

  /**
   * Validate transformed order data
   */
  static validate(transformedOrder: TransformedOrder): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!transformedOrder.customerName?.trim()) {
      errors.push('Customer name is required');
    }

    if (transformedOrder.totalAmount <= 0) {
      errors.push('Total amount must be greater than 0');
    }

    if (!transformedOrder.address?.trim()) {
      errors.push('Address is required');
    }

    if (!transformedOrder.items?.length) {
      errors.push('At least one order item is required');
    }

    transformedOrder.items?.forEach((item, index) => {
      if (item.qty <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      }
      if (!item.name?.trim()) {
        errors.push(`Item ${index + 1}: Name is required`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Batch processing utilities
 */
export class BatchTransformer {
  /**
   * Transform multiple WooCommerce customers
   */
  static transformCustomers(wcCustomers: WooCustomer[]): {
    successful: TransformedClient[];
    failed: { customer: WooCustomer; error: string }[];
  } {
    const successful: TransformedClient[] = [];
    const failed: { customer: WooCustomer; error: string }[] = [];

    wcCustomers.forEach((customer) => {
      try {
        const transformed = ClientTransformer.transform(customer);
        successful.push(transformed);
      } catch (error) {
        failed.push({
          customer,
          error: error instanceof Error ? error.message : 'Unknown transformation error',
        });
      }
    });

    return { successful, failed };
  }

  /**
   * Transform multiple WooCommerce orders
   */
  static transformOrders(wcOrders: WooOrder[]): {
    successful: TransformedOrder[];
    failed: { order: WooOrder; error: string }[];
  } {
    const successful: TransformedOrder[] = [];
    const failed: { order: WooOrder; error: string }[] = [];

    wcOrders.forEach((order) => {
      try {
        const transformed = OrderTransformer.transform(order);
        const validation = OrderTransformer.validate(transformed);

        if (validation.isValid) {
          successful.push(transformed);
        } else {
          failed.push({
            order,
            error: `Validation failed: ${validation.errors.join(', ')}`,
          });
        }
      } catch (error) {
        failed.push({
          order,
          error: error instanceof Error ? error.message : 'Unknown transformation error',
        });
      }
    });

    return { successful, failed };
  }
}

// Export utility instances
export const orderStatusMapper = OrderStatusMapper;
export const addressTransformer = AddressTransformer;
export const clientTransformer = ClientTransformer;
export const orderTransformer = OrderTransformer;
export const batchTransformer = BatchTransformer;

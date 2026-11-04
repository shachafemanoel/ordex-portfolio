/**
 * Customer resolution utilities for WooCommerce order backfill
 */

import { PrismaClient } from '@prisma/client';

export interface WooOrderData {
  id: number;
  customer_id?: number | null;
  billing?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
  };
}

/**
 * Resolve customer ID from WooCommerce order data
 * Priority: 1) wooCustomerId, 2) email, 3) null if no match
 */
export async function resolveCustomerIdFromWoo(
  prisma: PrismaClient,
  wooOrder: WooOrderData
): Promise<string | null> {
  // 1. Try to find by WooCommerce customer ID
  if (wooOrder.customer_id && wooOrder.customer_id > 0) {
    /* 
     * FIXME: wooCustomerId is missing from Customer schema. Disabling this lookup for now.
     * 
    const customerByWooId = await prisma.customer.findUnique({
      where: { wooCustomerId: wooOrder.customer_id },
      select: { id: true }
    });
    if (customerByWooId) {
      return customerByWooId.id;
    }
    */
  }

  // 2. Try to find by email (most reliable for guest checkouts)
  const email = wooOrder.billing?.email?.toLowerCase()?.trim();
  if (email && email.includes('@')) {
    // Email is not unique in schema, use findFirst
    const customerByEmail = await prisma.customer.findFirst({
      where: { email },
      select: { id: true },
    });
    if (customerByEmail) {
      return customerByEmail.id;
    }
  }

  // 3. No match found
  return null;
}

/**
 * Create customer from WooCommerce order data when no existing customer is found
 * This is optional - only use if you want to auto-create customers
 */
export async function createCustomerFromWooOrder(
  prisma: PrismaClient,
  wooOrder: WooOrderData
): Promise<string | null> {
  const email = wooOrder.billing?.email?.toLowerCase()?.trim();

  // Don't create customers without email
  if (!email || !email.includes('@')) {
    return null;
  }

  // Build full name
  const firstName = wooOrder.billing?.first_name || wooOrder.shipping?.first_name || '';
  const lastName = wooOrder.billing?.last_name || wooOrder.shipping?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Customer';

  try {
    const customer = await prisma.customer.create({
      data: {
        email,
        name: fullName, // Mapped to 'name' in schema
        phone: wooOrder.billing?.phone || null,
        // wooCustomerId: wooOrder.customer_id && wooOrder.customer_id > 0 ? wooOrder.customer_id : null,
        // isActive: true, // Removed as it does not exist in schema
      },
      select: { id: true },
    });

    return customer.id;
  } catch (error) {
    // Handle unique constraint violations gracefully
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      // Customer with this email already exists, try to find them
      const existingCustomer = await prisma.customer.findFirst({
        where: { email },
        select: { id: true },
      });
      return existingCustomer?.id || null;
    }

    console.error('Failed to create customer from WooCommerce order:', error);
    return null;
  }
}

/**
 * Resolve or create customer from WooCommerce order data
 * First tries to resolve existing, then optionally creates new
 */
export async function resolveOrCreateCustomerFromWoo(
  prisma: PrismaClient,
  wooOrder: WooOrderData,
  options: { createIfNotFound?: boolean } = {}
): Promise<string | null> {
  // First try to resolve existing customer
  const existingCustomerId = await resolveCustomerIdFromWoo(prisma, wooOrder);
  if (existingCustomerId) {
    return existingCustomerId;
  }

  // Optionally create new customer if not found
  if (options.createIfNotFound) {
    return createCustomerFromWooOrder(prisma, wooOrder);
  }

  return null;
}

export async function getCachedWooOrderData(
  _prisma: PrismaClient,
  wooOrderId: number
): Promise<WooOrderData | null> {
  // For now, return minimal structure
  // In a real implementation, you might:
  // 1. Have a separate table storing raw WooCommerce data
  // 2. Or fetch from WooCommerce API again
  // 3. Or store billing/shipping data in Order model

  return {
    id: wooOrderId,
    customer_id: null, // Would come from stored data
    billing: {
      email: undefined, // Would come from stored data
      first_name: undefined,
      last_name: undefined,
      phone: undefined,
    },
  };
}

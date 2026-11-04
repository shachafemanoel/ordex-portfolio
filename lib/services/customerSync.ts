import { prisma } from '@/lib/db';
import { getWooCommerceClient } from '@/lib/woocommerce';
import { WooOrder, WooCustomer } from '@/lib/woocommerce/types';
import { AddressType } from '@prisma/client';

export class CustomerSyncService {
  /**
   * Ensure a customer exists in WooCommerce, creating if necessary.
   * Returns the WooCommerce Customer ID.
   */
  static async ensureWooCustomer(data: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  }): Promise<number> {
    if (!data.email) {
      throw new Error('Email is required to sync customer');
    }

    const wooClient = getWooCommerceClient();
    if (!wooClient) {
      throw new Error('WooCommerce client not configured');
    }

    // Check if customer exists by email
    const customersResponse = await wooClient.getCustomers({ search: data.email });
    if (customersResponse.data && customersResponse.data.length > 0) {
      const match = customersResponse.data.find((c) => c.email === data.email);
      if (match?.id) return match.id;
    }

    // Create new customer
    const newCustomer = await wooClient.createCustomer({
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      billing: {
        first_name: data.first_name,
        last_name: data.last_name,
        company: data.company,
        address_1: data.address_1,
        address_2: data.address_2,
        city: data.city,
        state: data.state,
        postcode: data.postcode,
        country: data.country,
        email: data.email,
        phone: data.phone,
      },
      username: data.email, // Use email as username
    });

    if (!newCustomer.id) {
      throw new Error('Failed to create customer: No ID returned');
    }

    return newCustomer.id;
  }

  /**
   * Upsert local customer profile from WooCommerce order data.
   * Returns customer ID and address IDs.
   */
  static async upsertCustomerProfileFromOrder(order: WooOrder): Promise<{
    customerId: string;
    billingAddressId: string;
    shippingAddressId: string;
  } | null> {
    if (!order.billing?.email) return null;

    const email = order.billing.email;
    let customerId: string;

    // Find existing customer by email
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [{ email }],
      },
    });

    if (existing) {
      customerId = existing.id;
      // Update customer details if needed
      const updateData: any = {};
      if (!existing.phone && order.billing.phone) updateData.phone = order.billing.phone;
      if (
        (!existing.name || existing.name === 'Unknown') &&
        (order.billing.first_name || order.billing.last_name)
      ) {
        updateData.name = [order.billing.first_name, order.billing.last_name]
          .filter(Boolean)
          .join(' ');
      }

      // Update city from billing if missing
      if (!existing.city && order.billing.city) {
         updateData.city = order.billing.city;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: updateData,
        });
      }
    } else {
      // Create new customer
      const newCustomer = await prisma.customer.create({
        data: {
          name:
            [order.billing.first_name, order.billing.last_name].filter(Boolean).join(' ') ||
            'Unknown',
          email,
          phone: order.billing.phone,
          city: order.billing.city,
        },
      });
      customerId = newCustomer.id;
    }

    // Upsert Addresses
    const billingAddressId = await this.upsertAddress(
      customerId,
      order.billing,
      AddressType.BILLING
    );

    // Use shipping address if available, otherwise fallback to billing
    const shippingData = (order.shipping && (order.shipping.address_1 || order.shipping.city))
      ? order.shipping
      : order.billing;

    const shippingAddressId = await this.upsertAddress(
      customerId,
      shippingData,
      AddressType.SHIPPING
    );

    return {
      customerId,
      billingAddressId,
      shippingAddressId,
    };
  }

  /**
   * Helper to upsert address
   */
  private static async upsertAddress(
    customerId: string,
    addressData: any,
    type: AddressType
  ): Promise<string> {
    const city = addressData.city || '';
    // Parse address for street/number split
    const { streetName, houseNumber } = this.parseAddress(addressData.address_1 || '');

    // Check if address exists
    // We match loosely on city and street to avoid duplicates
    // Using findFirst instead of unique constraint
    const existingAddress = await prisma.address.findFirst({
      where: {
        customerId,
        type,
        city: { equals: city, mode: 'insensitive' },
        street: { contains: streetName, mode: 'insensitive' },
      },
    });

    if (existingAddress) {
      return existingAddress.id;
    }

    const newAddress = await prisma.address.create({
      data: {
        customerId,
        type,
        city: city || 'Unknown',
        street: streetName || 'Unknown',
        number: houseNumber || '-',
        apartment: addressData.address_2 || null,
        // lat/lng not available yet
      },
    });

    return newAddress.id;
  }

  private static parseAddress(fullAddress: string): { streetName: string; houseNumber: string } {
      if (!fullAddress) return { streetName: '', houseNumber: '' };

      const parts = fullAddress.trim().split(/\s+/);
      if (parts.length < 2) return { streetName: fullAddress, houseNumber: '' };

      const lastPart = parts[parts.length - 1];
      // Check if last part is number (digits, optionally followed by letter)
      if (/^\d+[a-zA-Z]?$/.test(lastPart)) {
          return {
              streetName: parts.slice(0, -1).join(' '),
              houseNumber: lastPart
          };
      }

      const firstPart = parts[0];
      if (/^\d+[a-zA-Z]?$/.test(firstPart)) {
          return {
              streetName: parts.slice(1).join(' '),
              houseNumber: firstPart
          };
      }

      return { streetName: fullAddress, houseNumber: '' };
  }

  /**
   * Upsert local customer profile from WooCommerce webhook payload.
   */
  static async upsertCustomerFromWebhook(customer: WooCustomer): Promise<void> {
    if (!customer.email) return;

    const email = customer.email;
    const firstName = customer.first_name || customer.billing?.first_name || '';
    const lastName = customer.last_name || customer.billing?.last_name || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
    const phone = customer.billing?.phone || '';
    const city = customer.billing?.city || '';

    // Find existing customer by email
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [{ email }],
      },
    });

    if (existing) {
      // Update customer details if needed
      const updateData: any = {};

      if (!existing.phone && phone) updateData.phone = phone;
      if (!existing.city && city) updateData.city = city;

      if (
        (!existing.name || existing.name === 'Unknown') &&
        name !== 'Unknown'
      ) {
        updateData.name = name;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: updateData,
        });
      }
    } else {
      // Create new customer
      await prisma.customer.create({
        data: {
          name,
          email,
          phone,
          city,
          // Defaults handled by DB
        },
      });
    }
  }
}

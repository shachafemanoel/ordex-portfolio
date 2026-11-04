/**
 * Customer normalization utilities
 * Ensures consistent customer data structure across the application
 */
import type { CustomerAddressDTO, CustomerDTO } from '@/domain/customers/customerDTO';

function coerceDate(input: unknown): Date | null {
  if (!input) {
    return null;
  }
  const date = input instanceof Date ? input : new Date(input as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function coerceNumber(input: unknown, fallback = 0): number {
  if (typeof input === 'number') {
    return input;
  }
  if (typeof input === 'bigint') {
    return Number(input);
  }
  if (typeof input === 'string') {
    const parsed = Number(input);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  if (input && typeof input === 'object') {
    const withToNumber = input as { toNumber?: () => number };
    if (typeof withToNumber.toNumber === 'function') {
      return withToNumber.toNumber();
    }
    const valueOf = (input as { valueOf?: () => unknown }).valueOf?.();
    if (typeof valueOf === 'number') {
      return valueOf;
    }
    if (typeof valueOf === 'string') {
      const parsed = Number(valueOf);
      return Number.isNaN(parsed) ? fallback : parsed;
    }
  }
  return fallback;
}

function normalizeAddress(
  address: any,
  fallbackType?: CustomerAddressDTO['type']
): CustomerAddressDTO {
  if (!address || typeof address !== 'object') {
    return {
      id: undefined,
      type: fallbackType ?? null,
      city: null,
      street: null,
      houseNumber: null,
      floor: null,
      apartment: null,
      notes: null,
      lat: null,
      lng: null,
    };
  }

  const resolvedType = (address.type ??
    address.addressType ??
    fallbackType ??
    null) as CustomerAddressDTO['type'];

  return {
    id: address.id ?? undefined,
    type: resolvedType,
    city: address.city ?? address.address_city ?? null,
    street: address.street ?? address.address_street ?? null,
    houseNumber: address.number ?? address.houseNumber ?? address.house_number ?? null,
    floor: address.floor ?? null,
    apartment: address.apartment ?? null,
    notes: address.notes ?? null,
    lat: typeof address.lat === 'number' ? address.lat : null,
    lng: typeof address.lng === 'number' ? address.lng : null,
    createdAt: coerceDate(address.createdAt ?? address.created_at ?? null),
    updatedAt: coerceDate(address.updatedAt ?? address.updated_at ?? null),
  };
}

function resolveAddresses(customer: any): CustomerAddressDTO[] {
  const addresses: CustomerAddressDTO[] = Array.isArray(customer?.addresses)
    ? customer.addresses.map((address: any) => normalizeAddress(address))
    : [];

  if (addresses.length === 0) {
    const legacyAddress = normalizeAddress(
      {
        city: customer?.city ?? customer?.address_city,
        street: customer?.street ?? customer?.address_street,
        house_number: customer?.house_number ?? customer?.number,
        floor: customer?.floor,
        notes: customer?.notes,
      },
      'SHIPPING'
    );

    if (legacyAddress.city || legacyAddress.street || legacyAddress.houseNumber) {
      addresses.push(legacyAddress);
    }
  }

  return addresses.filter(
    (addr) => addr.city !== null || addr.street !== null || addr.houseNumber !== null
  );
}

function deriveFullName(customer: any): string {
  const nameCandidates = [
    customer?.fullName,
    customer?.full_name,
    customer?.name,
    customer?.displayName,
    customer?.customerName,
  ].filter(Boolean);

  if (nameCandidates.length > 0) {
    return String(nameCandidates[0]);
  }

  const first = customer?.firstName ?? customer?.first_name;
  const last = customer?.lastName ?? customer?.last_name;
  const combined = [first, last].filter(Boolean).join(' ').trim();

  if (combined.length > 0) {
    return combined;
  }

  return customer?.email ?? 'לקוח ללא שם';
}

export function normalizeCustomer(customer: any): CustomerDTO | null {
  if (!customer || !customer.id) {
    return null;
  }

  const fullName = deriveFullName(customer);
  const email = customer.email ?? customer.customerEmail ?? customer.email_address ?? null;
  const phone =
    customer.phone ??
    customer.phoneNumber ??
    customer.phone_number ??
    customer.customerPhone ??
    null;

  const addresses = resolveAddresses(customer);
  const shipping = addresses.find((address) => address.type?.toUpperCase() === 'SHIPPING');
  const billing = addresses.find((address) => address.type?.toUpperCase() === 'BILLING');
  const primary = shipping ?? billing ?? addresses[0];

  const city = primary?.city ?? customer.city ?? customer.address_city ?? null;
  const street = primary?.street ?? customer.street ?? customer.address_street ?? null;
  const houseNumber = primary?.houseNumber ?? customer.house_number ?? customer.number ?? null;
  const floor = primary?.floor ?? customer.floor ?? null;
  const apartment = primary?.apartment ?? customer.apartment ?? null;
  const notes = customer.notes ?? customer.accountNotes ?? primary?.notes ?? null;

  return {
    id: customer.id,
    fullName,
    name: fullName,
    email,
    phone,
    city,
    street,
    houseNumber,
    floor,
    apartment,
    notes,
    accountNotes: customer.accountNotes ?? null,
    addresses,
    // Prefer the live relational count (_count.orders) over the potentially-stale
    // denormalized field (ordersCount), falling back to array length or the field itself.
    ordersCount: coerceNumber(
      customer._count?.orders ?? customer.orders?.length ?? customer.ordersCount ?? 0
    ),
    clvCents: coerceNumber(customer.clvCents ?? 0),
    currentBalanceCents: coerceNumber(customer.currentBalanceCents ?? 0),
    firstOrderAt: coerceDate(customer.firstOrderAt),
    createdAt: coerceDate(customer.createdAt),
    updatedAt: coerceDate(customer.updatedAt),
    creditLimitCents:
      customer.creditLimitCents === null || customer.creditLimitCents === undefined
        ? null
        : coerceNumber(customer.creditLimitCents),
    paymentTermsDays:
      customer.paymentTermsDays === null || customer.paymentTermsDays === undefined
        ? null
        : coerceNumber(customer.paymentTermsDays),
  };
}

export function normalizeCustomers(customers: any[]): CustomerDTO[] {
  if (!Array.isArray(customers)) return [];
  return customers
    .map(normalizeCustomer)
    .filter((customer): customer is CustomerDTO => Boolean(customer));
}

/**
 * Address formatting utilities for orders
 */

export interface AddressComponents {
  street?: string | null;
  number?: string | null;
  city?: string | null;
  addressLine?: string | null;
  addressRaw?: string | null;
  addressFormatted?: string | null;
}

export interface OrderWithAddress {
  shippingAddress?: {
    street?: string | null;
    number?: string | null;
    city?: string | null;
  } | null;
  addressLine?: string | null;
  addressRaw?: string | null;
  addressFormatted?: string | null;
  city?: string | null;
}

/**
 * Get full formatted address from order data
 * Priority: addressFormatted > shippingAddress (street + number + city) > addressLine + city > addressRaw
 */
export function getFullAddress(order: OrderWithAddress): string {
  // First priority: addressFormatted from geocoding
  if (order.addressFormatted) {
    return order.addressFormatted;
  }

  // Second priority: build from shippingAddress components
  if (order.shippingAddress) {
    const parts = [
      order.shippingAddress.street,
      order.shippingAddress.number,
      order.shippingAddress.city || order.city,
    ].filter(Boolean);

    if (parts.length >= 2) {
      // At least street and one other component
      return parts.join(' ');
    }
  }

  // Third priority: addressLine with city
  if (order.addressLine) {
    const city = order.city;
    if (city && !order.addressLine.includes(city)) {
      return `${order.addressLine}, ${city}`;
    }
    return order.addressLine;
  }

  // Fourth priority: addressRaw
  if (order.addressRaw) {
    return order.addressRaw;
  }

  // Fallback
  return 'כתובת לא זמינה';
}

/**
 * Get short address (without city) for compact display
 */
export function getShortAddress(order: OrderWithAddress): string {
  if (order.shippingAddress) {
    const parts = [order.shippingAddress.street, order.shippingAddress.number].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }

  if (order.addressLine) {
    // Try to remove city from addressLine if present
    const city = order.city;
    if (city && order.addressLine.includes(city)) {
      return order.addressLine.replace(new RegExp(`,?\\s*${city}\\s*,?`), '').trim();
    }
    return order.addressLine;
  }

  return order.addressRaw || 'לא צוינה';
}

/**
 * Get city name from order
 */
export function getCity(order: OrderWithAddress): string {
  return order.shippingAddress?.city || order.city || 'לא צוין';
}

/**
 * Build navigation URL for Waze
 */
export function getWazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

/**
 * Build navigation URL for Google Maps
 */
export function getGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Build navigation URL for Google Maps with coordinates
 */
export function getGoogleMapsUrlWithCoords(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

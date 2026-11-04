interface AddressFields {
  street?: string | null;
  number?: string | null;
  city?: string | null;
  floor?: string | null;
  apartment?: string | null;
  notes?: string | null;
}

interface FormatAddressOptions {
  includeFloor?: boolean;
  includeApartment?: boolean;
  includeNotes?: boolean;
  separator?: string;
}

/**
 * Formats address fields into a complete, readable Hebrew address string
 * @param address - Address object with optional fields
 * @param options - Formatting options
 * @returns Formatted address string
 */
export function formatAddress(
  address: AddressFields | null | undefined,
  options: FormatAddressOptions = {}
): string {
  if (!address) return 'לא הוגדר';

  const {
    includeFloor = true,
    includeApartment = true,
    includeNotes = true,
    separator = ', ',
  } = options;

  const parts: string[] = [];

  // Main address: street number, city
  if (address.street && address.number && address.city) {
    parts.push(`${address.street} ${address.number}, ${address.city}`);
  } else if (address.city && address.street) {
    parts.push(`${address.street}, ${address.city}`);
  } else if (address.city) {
    parts.push(address.city);
  }

  // Additional details
  const details: string[] = [];
  if (includeFloor && address.floor) {
    details.push(`קומה ${address.floor}`);
  }
  if (includeApartment && address.apartment) {
    details.push(`דירה ${address.apartment}`);
  }

  if (details.length > 0) {
    parts.push(details.join(', '));
  }

  if (includeNotes && address.notes) {
    parts.push(`(${address.notes})`);
  }

  return parts.length > 0 ? parts.join(separator) : 'לא הוגדר';
}

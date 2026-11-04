/**
 * Canonical customer DTO definitions
 */

export interface CustomerAddressDTO {
  id?: string;
  type?: 'BILLING' | 'SHIPPING' | string | null;
  city?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  floor?: string | null;
  apartment?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface CustomerDTO {
  id: string;
  fullName: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  floor?: string | null;
  apartment?: string | null;
  notes?: string | null;
  accountNotes?: string | null;
  addresses: CustomerAddressDTO[];
  ordersCount: number;
  clvCents: number;
  currentBalanceCents: number;
  firstOrderAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  creditLimitCents?: number | null;
  paymentTermsDays?: number | null;
}

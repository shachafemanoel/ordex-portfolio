// Shared Core Types - Common across all domains
// This file serves as the single source of truth for cross-domain types

// Common primitives
export type ID = string;
export type Timestamp = string; // ISO 8601

// Common status types
export type CreditStatus = 'GOOD' | 'WARNING' | 'BLOCKED';

// Re-export commonly used Prisma types for convenience
export type { OrderStatus, PaymentStatus } from '@prisma/client';

// Common address type (used across domains)
export interface BaseAddress {
  id: string;
  type?: string;
  city: string | null;
  street: string | null;
  number: string | null;
  floor: string | null;
  fullAddress: string;
  coordinates: { lat: number; lng: number } | null;
  notes: string | null;
}

// Common user summary (used across domains)
export interface UserSummary {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

// Common pagination types
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// Common filter types
export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

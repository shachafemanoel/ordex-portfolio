export interface SupplierDTO {
  id: string;
  name: string;
  govId?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  paymentTerms?: string | null;
  rating?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productsCount?: number;
  purchaseOrdersCount?: number;
  lastPurchaseOrderAt?: string | null;
}

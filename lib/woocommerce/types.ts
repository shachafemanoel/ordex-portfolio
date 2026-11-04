export interface WooAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface WooLineItem {
  id?: number;
  product_id?: number;
  variation_id?: number;
  sku?: string;
  name?: string;
  quantity?: number;
  price?: string;
  total?: string;
}

export interface WooOrder {
  id: number;
  status: string;
  number?: string;
  customer_note?: string;
  payment_method_title?: string;
  payment_method?: string;
  transaction_id?: string;
  order_key?: string;
  customer_id?: number;
  billing?: WooAddress;
  shipping?: WooAddress;
  line_items?: WooLineItem[];
  total?: string;
  date_created?: string;
  date_modified?: string;
  date_paid?: string | null;
}

export interface WooCustomer {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
  date_created?: string;
  is_paying_customer?: boolean;
  billing?: WooAddress;
  shipping?: WooAddress;
}

export interface WooProduct {
  id: number;
  name?: string;
  sku?: string;
  status?: string;
  price?: string;
  stock_quantity?: number | null;
  description?: string;
  short_description?: string;
}

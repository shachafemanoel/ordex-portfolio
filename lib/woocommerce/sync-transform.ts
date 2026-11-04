import type { WooProduct } from './types';

export function mapProductToSkus(product: WooProduct): Array<{ sku: string; name: string }> {
  if (product.sku) {
    return [{ sku: product.sku, name: product.name || product.sku }];
  }
  return [];
}

export function mapVariationToSku(variation: Record<string, unknown>): { sku: string; name: string } | null {
  const sku = variation.sku as string;
  if (!sku) return null;
  return { sku, name: (variation.name as string) || sku };
}

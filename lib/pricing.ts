/**
 * Pricing utilities for effective price calculation.
 *
 * Products may have a base price and an optional sale/promo price
 * that is only active within a specified promo window.
 */

export interface PriceInput {
  basePriceCents: number | null;
  salePriceCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
}

export interface EffectivePrice {
  priceCents: number;
  wasOnSale: boolean;
  originalPriceCents: number | null;
}

/**
 * Determine the effective price for a product, taking into account
 * any active promotional/sale pricing window.
 */
export function getEffectivePrice(product: PriceInput, now: Date = new Date()): EffectivePrice {
  const isPromoActive =
    product.salePriceCents != null &&
    (!product.promoStartsAt || product.promoStartsAt <= now) &&
    (!product.promoEndsAt || product.promoEndsAt >= now);

  if (isPromoActive) {
    return {
      priceCents: product.salePriceCents!,
      wasOnSale: true,
      originalPriceCents: product.basePriceCents,
    };
  }

  return {
    priceCents: product.basePriceCents ?? 0,
    wasOnSale: false,
    originalPriceCents: null,
  };
}

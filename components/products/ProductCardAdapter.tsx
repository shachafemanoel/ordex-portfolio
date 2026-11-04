'use client';

import { ProductRecord } from '@/components/products/workspace/types';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { Plus, Tag } from 'lucide-react';
import React from 'react';

/**
 * ProductCardAdapter - Transforms Prisma/ProductRecord to Mobile ProductCard props
 *
 * This adapter bridges the gap between:
 * - ProductRecord/Prisma Product (backend data model)
 * - Mobile ProductCard component (UI component)
 *
 * Responsibilities:
 * - Field transformation (basePriceCents → price in NIS, stock → availability)
 * - Price conversion (cents to decimal with NIS symbol)
 * - Availability calculation (stock > 0)
 * - Sale detection (from salePrice or featured flag)
 * - Supplier name extraction
 *
 * @example
 * ```tsx
 * <ProductCardAdapter
 *   product={productRecord}
 *   onClick={() => openProductDetail(product.id)}
 * />
 * ```
 */

// Prisma Product interface (subset of fields used by ProductCard)
export interface PrismaProductForCard {
  id: string;
  sku: string;
  name: string;
  basePriceCents?: number | null;
  stock: number;
  imageUrl?: string | null;
  is_available?: boolean;
  isFeatured?: boolean;
  supplier?: {
    name: string;
  } | null;
  defaultSupplier?: {
    name: string;
  } | null;
}

// Mobile ProductCard props
interface MobileProductProps {
  product: {
    sku: string;
    name: string;
    price: number;
    availability: boolean;
    imageUrl?: string | null;
    sale?: boolean;
    supplier?: string;
  };
}

export interface ProductCardAdapterProps {
  /** Product data (ProductRecord or Prisma Product) */
  product: ProductRecord | PrismaProductForCard;
  /** Click handler */
  onClick?: () => void;
  /** Additional children (for legacy compatibility) */
  children?: React.ReactNode;
}

/**
 * Transform ProductRecord/Prisma Product to Mobile Product props
 */
export function transformProductForMobile(
  product: ProductRecord | PrismaProductForCard
): MobileProductProps['product'] {
  // Determine price
  let price: number;
  if ('price' in product && typeof product.price === 'number') {
    // ProductRecord has price as number
    price = product.price;
  } else if ('basePriceCents' in product && product.basePriceCents) {
    // Prisma Product has basePriceCents
    price = product.basePriceCents / 100;
  } else {
    price = 0;
  }

  // Determine availability
  let availability: boolean;
  if ('stock' in product) {
    availability = product.stock > 0;
  } else if ('is_available' in product && typeof (product as any).is_available === 'boolean') {
    availability = (product as any).is_available ?? false;
  } else {
    availability = false;
  }

  // Determine if on sale
  const sale = product.isFeatured || false;

  // Get supplier name
  let supplier: string | undefined;
  if ('supplier' in product) {
    const supplierField = product.supplier;
    if (typeof supplierField === 'string') {
      supplier = supplierField;
    } else if (supplierField && typeof supplierField === 'object' && 'name' in supplierField) {
      supplier = supplierField.name;
    }
  } else if ('defaultSupplier' in product && product.defaultSupplier) {
    supplier = product.defaultSupplier.name;
  }

  return {
    sku: product.sku,
    name: product.name,
    price,
    availability,
    imageUrl: product.imageUrl ?? null,
    sale,
    supplier,
  };
}

/**
 * ProductCardAdapter Component
 */
export function ProductCardAdapter({ product, onClick }: ProductCardAdapterProps) {
  const mobileProduct = transformProductForMobile(product);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group flex h-full cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md active:scale-[0.99]',
        !mobileProduct.availability && 'opacity-90'
      )}
      dir="rtl"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-slate-50">
        {mobileProduct.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mobileProduct.imageUrl}
            alt={mobileProduct.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).src = ''; // Clear src on error to show fallback
              (e.target as HTMLImageElement).classList.add('hidden');
            }}
          />
        ) : null}

        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-slate-300',
            mobileProduct.imageUrl && 'hidden group-has-[img.hidden]:flex'
          )}
        >
          <Tag className="h-8 w-8" />
        </div>

        {mobileProduct.sale ? (
          <div className="absolute right-2 top-2">
            <Badge className="border-rose-100 bg-rose-50 text-[10px] text-rose-700">מבצע</Badge>
          </div>
        ) : null}

        {!mobileProduct.availability ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75">
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-on-dark">
              חסר
            </span>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="text-[10px] text-slate-400">{mobileProduct.sku}</p>
          {mobileProduct.supplier ? (
            <p className="max-w-[45%] truncate text-[10px] font-medium text-blue-700">
              {mobileProduct.supplier}
            </p>
          ) : null}
        </div>

        <h4 className="line-clamp-2 text-sm font-semibold text-slate-900">{mobileProduct.name}</h4>
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
        <div className="leading-tight">
          <p className="text-base font-extrabold text-slate-900">₪{mobileProduct.price}</p>
          <p className="text-[10px] text-slate-400">כולל מע״מ</p>
        </div>

        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-on-dark transition-colors group-hover:bg-blue-700">
          <Plus className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// Export transformation function for use elsewhere
export { transformProductForMobile as transformProduct };

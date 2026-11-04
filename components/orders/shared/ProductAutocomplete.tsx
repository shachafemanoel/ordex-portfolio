'use client';

import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { getEffectivePrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Search } from 'lucide-react';

/** Letter-based avatar for products without images */
function ProductAvatar({ name, imageUrl, className }: { name: string; imageUrl?: string | null; className?: string }) {
  const letter = (name || '?').charAt(0).toUpperCase();
  // Simple color from name hash
  const colors = ['#e0f2fe', '#dcfce7', '#fef9c3', '#fce7f3', '#ede9fe', '#ffedd5'];
  const textColors = ['#0369a1', '#15803d', '#a16207', '#be185d', '#7c3aed', '#c2410c'];
  const idx = (name.charCodeAt(0) || 0) % colors.length;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={cn('h-10 w-10 rounded-lg object-cover', className)}
        onError={(e) => {
          // On error, replace with a div avatar
          const parent = (e.target as HTMLElement).parentElement;
          if (parent) {
            (e.target as HTMLElement).style.display = 'none';
            const fallback = document.createElement('div');
            fallback.className = `h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0`;
            fallback.style.background = colors[idx];
            fallback.style.color = textColors[idx];
            fallback.textContent = letter;
            parent.appendChild(fallback);
          }
        }}
      />
    );
  }

  return (
    <div
      className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0', className)}
      style={{ background: colors[idx], color: textColors[idx] }}
    >
      {letter}
    </div>
  );
}
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  basePriceCents: number | null;
  salePriceCents?: number | null;
  promoStartsAt?: string | null;
  promoEndsAt?: string | null;
  stock: number;
  supplierId: string | null;
  supplierName: string | null;
  ordersCount: number;
  imageUrl?: string | null;
  inventoryEnabled?: boolean;
  procurementRequired?: boolean;
  serialNumberType?: 'NONE' | 'AUTO' | 'MANUAL';
}

interface ProductAutocompleteProps {
  supplierId?: string;
  supplierName?: string;
  onSelect: (product: ProductSearchResult) => void;
  placeholder?: string;
  selectedProductName?: string;
  disabled?: boolean;
  className?: string;
}

export function ProductAutocomplete({
  supplierId,
  supplierName,
  onSelect,
  placeholder,
  selectedProductName,
  disabled = false,
  className,
}: ProductAutocompleteProps) {
  const { success: showSuccess, error: showError } = useToast();
  const { t, locale, direction } = useUITranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const localeTag = locale === 'he' ? 'he-IL' : 'en-US';
  const inputPlaceholder =
    selectedProductName || placeholder || t('orders.new.products.autocomplete.placeholder');

  // Stable ref for t() so it doesn't invalidate searchProducts on every render
  const tRef = useRef(t);
  tRef.current = t;

  // Search products API call
  const searchProducts = useCallback(
    async (term: string) => {
      if (!term || term.length < 1) {
        setProducts([]);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          term,
          limit: '15',
        });

        // Add supplierId only if provided
        if (supplierId) {
          params.set('supplierId', supplierId);
        }

        const response = await apiClient(`/api/products/search?${params}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(tRef.current('orders.new.products.autocomplete.searchFailed'));
        }

        const data = await response.json();
        setProducts(data.data?.products || data.products || []);
      } catch (error) {
        console.error('Product search error:', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    },
    [supplierId]
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm) {
      debounceRef.current = setTimeout(() => {
        searchProducts(searchTerm);
      }, 300);
    } else {
      setProducts([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, searchProducts]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle product selection
  const handleSelect = useCallback(
    (product: ProductSearchResult) => {
      onSelect(product);
      setSearchTerm('');
      setIsOpen(false);
      setProducts([]);
    },
    [onSelect]
  );

  // Handle create new product
  const handleCreateProduct = useCallback(async () => {
    if (!searchTerm.trim()) return;

    setIsCreating(true);
    try {
      const response = await apiClient('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchTerm.trim(),
          supplierId: supplierId || null, // Optional supplier
          basePriceCents: 0,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || t('orders.new.products.autocomplete.createFailed'));
      }

      const newProduct = data.data as ProductSearchResult;

      if (data.created) {
        showSuccess(
          t('orders.new.products.autocomplete.toast.created', undefined, {
            params: { name: newProduct.name },
          })
        );
      } else {
        showSuccess(
          t('orders.new.products.autocomplete.toast.existingFound', undefined, {
            params: { name: newProduct.name },
          })
        );
      }

      handleSelect(newProduct);
    } catch (error) {
      console.error('Create product error:', error);
      showError(
        error instanceof Error ? error.message : t('orders.new.products.autocomplete.createFailed')
      );
    } finally {
      setIsCreating(false);
    }
  }, [handleSelect, searchTerm, showError, showSuccess, supplierId, t]);

  // Check if exact match exists
  const exactMatch = products.find((p) => p.name.toLowerCase() === searchTerm.toLowerCase());

  const showCreateOption = searchTerm.trim() && !exactMatch && !isLoading;

  return (
    <div ref={containerRef} className={cn('relative', className)} dir={direction}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={inputPlaceholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          className={cn(selectedProductName && !searchTerm ? 'text-gray-900' : '', className)}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
      </div>

      {isOpen && (searchTerm || products.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Product results */}
          {products.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelect(product)}
                  className="w-full text-right px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <ProductAvatar name={product.name} imageUrl={product.imageUrl} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                        {product.name}
                        {(() => {
                          const { wasOnSale } = getEffectivePrice({
                            basePriceCents: product.basePriceCents,
                            salePriceCents: product.salePriceCents ?? null,
                            promoStartsAt: product.promoStartsAt
                              ? new Date(product.promoStartsAt)
                              : null,
                            promoEndsAt: product.promoEndsAt ? new Date(product.promoEndsAt) : null,
                          });
                          return (
                            wasOnSale && (
                              <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                {t('orders.new.products.saleTag')}
                              </span>
                            )
                          );
                        })()}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t('orders.new.products.autocomplete.skuPrefix', undefined, {
                          params: { sku: product.sku },
                        })}
                        {(() => {
                          const { priceCents, wasOnSale } = getEffectivePrice({
                            basePriceCents: product.basePriceCents,
                            salePriceCents: product.salePriceCents ?? null,
                            promoStartsAt: product.promoStartsAt
                              ? new Date(product.promoStartsAt)
                              : null,
                            promoEndsAt: product.promoEndsAt ? new Date(product.promoEndsAt) : null,
                          });
                          return (
                            <span className="mr-2">
                              · ₪{(priceCents / 100).toLocaleString(localeTag)}
                              {wasOnSale && product.basePriceCents && (
                                <span className="line-through text-slate-400 mr-1 opacity-70">
                                  ₪{(product.basePriceCents / 100).toLocaleString(localeTag)}
                                </span>
                              )}
                            </span>
                          );
                        })()}
                        <span
                          className={`mr-2 ${product.stock <= 0 ? 'text-red-600 font-medium' : product.stock < 10 ? 'text-amber-600' : 'text-green-600'}`}
                        >
                          ·{' '}
                          {t('orders.new.products.autocomplete.stock', undefined, {
                            params: { count: product.stock },
                          })}
                        </span>
                        {product.ordersCount > 0 && (
                          <span className="mr-2">
                            ·{' '}
                            {t('orders.new.products.autocomplete.ordersCount', undefined, {
                              params: { count: product.ordersCount },
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {!isLoading && searchTerm && products.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500 border-b border-gray-100">
              {t('orders.new.products.autocomplete.noResults')}
            </div>
          )}

          {/* Create new product option */}
          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateProduct}
              disabled={isCreating}
              className="w-full text-right px-4 py-3 hover:bg-green-50 transition-colors bg-gray-50 border-t border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-green-100 rounded">
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-green-700">
                    {isCreating
                      ? t('orders.new.products.autocomplete.creating')
                      : t('orders.new.products.autocomplete.create', undefined, {
                          params: { term: searchTerm },
                        })}
                  </div>
                  <div className="text-xs text-green-600 mt-0.5">
                    {t('orders.new.products.autocomplete.linkToSupplier', undefined, {
                      params: {
                        supplier:
                          supplierName || t('orders.new.products.autocomplete.selectedSupplier'),
                      },
                    })}
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              <Loader2 className="w-4 h-4 animate-spin inline-block ml-2" />
              {t('orders.new.products.autocomplete.loading')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

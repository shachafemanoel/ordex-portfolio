'use client';

import { CategorySection } from '@/components/products/catalog/CategorySection';
import { mapApiProductToRecord } from '@/components/products/workspace/dataProvider';
import { ProductRecord } from '@/components/products/workspace/types';
import { useProductsQuery } from '@/lib/hooks/api/products';
import { Button } from '@/components/ui/Button';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { Filter, LayoutGrid, List, Loader2, Package, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PAGE_SIZE = 250;

export function ProductCatalog() {
  const { t, direction } = useUITranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [accumulatedProducts, setAccumulatedProducts] = useState<ProductRecord[]>([]);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset pagination when search changes
  useEffect(() => {
    setPage(1);
    setAccumulatedProducts([]);
  }, [debouncedSearch]);

  // Fetch current page via React Query
  const { data, isFetching, isLoading } = useProductsQuery({
    q: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });

  // Accumulate pages for infinite scroll
  useEffect(() => {
    if (!data?.items?.length) return;
    const newItems = data.items.map(mapApiProductToRecord);
    setAccumulatedProducts((prev) => (page === 1 ? newItems : [...prev, ...newItems]));
  }, [data?.items, page]);

  const hasMore =
    data != null &&
    data.pagination.total > 0 &&
    page * data.pagination.limit < data.pagination.total;

  const loading = isLoading && accumulatedProducts.length === 0;
  const fetchingMore = isFetching && page > 1;

  const loadMore = useCallback(() => {
    if (isFetching || !hasMore) return;
    setPage((p) => p + 1);
  }, [hasMore, isFetching]);

  // Intersection Observer
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isFetching, loadMore]);

  // Grouping
  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductRecord[]> = {};
    accumulatedProducts.forEach((p) => {
      const cat = p.category || t('products.catalog.defaultCategory');
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [accumulatedProducts, t]);

  const categories = Object.keys(groupedProducts).sort();

  return (
    <div className="flex flex-col h-full bg-gray-50/50" dir={direction}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('products.catalog.title')}</h1>
            <p className="text-sm text-gray-500">{t('products.catalog.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3 flex-1 md:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('products.searchPlaceholder')}
                className="w-full h-10 pr-10 pl-4 rounded-full border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-full shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
            <div className="h-8 w-[1px] bg-gray-200 mx-1"></div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button className="p-1.5 bg-white rounded shadow-sm text-primary-600">
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button className="p-1.5 text-gray-500 hover:text-gray-700">
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : categories.length === 0 && !isFetching ? (
            <div className="text-center py-20 text-gray-400">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-xl">{t('products.catalog.emptyState')}</p>
            </div>
          ) : (
            <>
              {categories.map((category) => (
                <CategorySection
                  key={category}
                  category={category}
                  products={groupedProducts[category]}
                />
              ))}

              {/* Load More Trigger */}
              <div ref={observerTarget} className="h-10 flex items-center justify-center mt-4">
                {fetchingMore && (
                  <div className="flex items-center gap-2 text-primary-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">{t('products.catalog.loadingMore')}</span>
                  </div>
                )}
                {!hasMore && accumulatedProducts.length > 0 && (
                  <p className="text-sm text-gray-400">{t('products.catalog.endReached')}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

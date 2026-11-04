import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
  className = '',
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );

    return {
      start: Math.max(0, visibleStart - overscan),
      end: Math.min(items.length - 1, visibleEnd + overscan),
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      setScrollTop(scrollTop);

      // Check if we're near the end for infinite scrolling
      if (onEndReached) {
        const { scrollHeight, clientHeight } = e.currentTarget;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        if (scrollPercentage >= endReachedThreshold) {
          onEndReached();
        }
      }
    },
    [onEndReached, endReachedThreshold]
  );

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {Array.from({ length: visibleRange.end - visibleRange.start + 1 }).map((_, index) => {
            const itemIndex = visibleRange.start + index;
            const item = items[itemIndex];

            if (!item) return null;

            return (
              <div key={itemIndex} style={{ height: itemHeight }} className="flex items-center">
                {renderItem(item, itemIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Hook for managing infinite scroll with virtualization
export function useInfiniteVirtualScroll<T>(
  initialItems: T[],
  fetchMore: () => Promise<T[]>,
  options: {
    threshold?: number;
    enabled?: boolean;
  } = {}
) {
  const { threshold = 0.8, enabled = true } = options;
  // Suppress unused variable warning for future use
  void threshold;
  const [items, setItems] = useState<T[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !enabled) return;

    setLoading(true);
    try {
      const newItems = await fetchMore();
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...newItems]);
      }
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, enabled, fetchMore]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return {
    items,
    loading,
    hasMore,
    loadMore,
  };
}

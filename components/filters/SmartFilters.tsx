'use client';

import { OrderFilterParams } from '@/lib/api/types';
import { ORDER_STATUS_COLORS, ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import type { OrderStatus } from '@prisma/client';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';

interface SmartFiltersProps {
  onFiltersChange: (filters: OrderFilterParams) => void;
  totalCount: number;
  className?: string;
  resetKey?: number;
}

const quickFilters = [
  { name: 'הכל', filters: {} },
  { name: 'לטיפול', filters: { status: ['TO_DO', 'CALL_BACK', 'PO_CREATED'] as OrderStatus[] } },
  { name: 'בהמתנה', filters: { status: ['AWAITING_STOCK', 'SCHEDULED'] as OrderStatus[] } },
  {
    name: 'הושלמו השבוע',
    filters: {
      status: ['COMPLETED'] as OrderStatus[],
      dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
];

export function SmartFilters({
  onFiltersChange,
  totalCount,
  className = '',
  resetKey,
}: SmartFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const [searchDebounce, setSearchDebounce] = useState('');

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchDebounce(search);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  // Notify parent of filter changes
  useEffect(() => {
    const filters: OrderFilterParams = {};

    if (searchDebounce) filters.search = searchDebounce;
    if (statuses.length > 0) filters.status = statuses;
    if (dateRange.start) (filters as any).dateFrom = new Date(dateRange.start).toISOString();
    if (dateRange.end) (filters as any).dateTo = new Date(dateRange.end).toISOString();

    onFiltersChange(filters);
  }, [searchDebounce, statuses, dateRange, onFiltersChange]);

  // Reset state when parent requests a clear
  useEffect(() => {
    if (resetKey === undefined) return;
    setSearch('');
    setStatuses([]);
    setDateRange({ start: '', end: '' });
    setIsExpanded(false);
  }, [resetKey]);

  const handleStatusToggle = (status: OrderStatus) => {
    setStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleQuickFilter = (quickFilter: (typeof quickFilters)[0]) => {
    if (quickFilter.name === 'הכל') {
      setSearch('');
      setStatuses([]);
      setDateRange({ start: '', end: '' });
    } else {
      if (quickFilter.filters.status) setStatuses(quickFilter.filters.status);
      if (quickFilter.filters.dateFrom) {
        // This is a bit tricky as the Input type=date expects YYYY-MM-DD
        // We'll just reset dates for now or try to parse if needed.
        // For 'Last Week', we can't easily set the input field without formatting
        const date = new Date(quickFilter.filters.dateFrom);
        setDateRange({
          start: date.toISOString().split('T')[0],
          end: '',
        });
      }
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setStatuses([]);
    setDateRange({ start: '', end: '' });
  };

  const activeFilterCount =
    (search ? 1 : 0) + statuses.length + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0);

  return (
    <div className={className}>
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Search and Quick Actions */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="חיפוש לפי מספר הזמנה, לקוח או טלפון..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  🔍
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 min-h-[44px] px-4"
              >
                <span>🎛️</span>
                <span>פילטרים</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-gray-500 hover:text-gray-700 min-h-[44px]"
                >
                  נקה הכל
                </Button>
              )}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <Button
                key={filter.name}
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter(filter)}
                className="text-sm min-h-[40px] px-4"
              >
                {filter.name}
              </Button>
            ))}
          </div>

          {/* Status Pills */}
          {isExpanded && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">סטטוסים</label>
                <div className="flex flex-wrap gap-2.5">
                  {ORDER_STATUS_OPTIONS.map((status) => {
                    const isActive = statuses.includes(status.value);
                    const colorClass =
                      ORDER_STATUS_COLORS[status.value] || 'bg-gray-100 text-gray-800';
                    return (
                      <Button
                        key={status.value}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusToggle(status.value)}
                        className={`text-sm min-h-[40px] px-4 ${isActive ? '' : colorClass.replace('bg-', 'hover:bg-').replace('text-', 'text-')}`}
                      >
                        {status.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מתאריך</label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">עד תאריך</label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t border-gray-100">
            <span>{totalCount.toLocaleString('he-IL')} הזמנות נמצאו</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

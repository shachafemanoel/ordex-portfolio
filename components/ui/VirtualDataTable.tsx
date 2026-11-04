'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
// import { Button } from '@/components/ui/Button'; // Unused import
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: number | string;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface VirtualDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  containerHeight?: number;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, string>) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  getRowId?: (item: T) => string;
  stickyHeader?: boolean;
  zebra?: boolean;
  compact?: boolean;
}

// Get cell value helper - moved outside for stability and reuse
function getCellValue<T>(item: T, key: keyof T | string): any {
  if (typeof key === 'string' && key.includes('.')) {
    return key.split('.').reduce((obj: any, k) => obj?.[k], item);
  }
  return item[key as keyof T];
}

interface VirtualTableRowProps<T> {
  item: T;
  columns: Column<T>[];
  index: number;
  rowHeight: number;
  zebra: boolean;
  compact: boolean;
  selectable: boolean;
  isSelected: boolean;
  getRowId: (item: T) => string;
  onRowClick?: (item: T, index: number) => void;
  onSelect?: (id: string, selected: boolean) => void;
}

function VirtualTableRowComponent<T extends Record<string, any>>({
  item,
  columns,
  index,
  rowHeight,
  zebra,
  compact,
  selectable,
  isSelected,
  getRowId,
  onRowClick,
  onSelect,
}: VirtualTableRowProps<T>) {
  const handleRowClick = () => {
    onRowClick?.(item, index);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(getRowId(item), !isSelected);
  };

  return (
    <div
      className={cn(
        'flex min-w-fit border-b border-gray-100 hover:bg-gray-50 transition-colors',
        zebra && index % 2 === 0 && 'bg-gray-25',
        onRowClick && 'cursor-pointer',
        isSelected && 'bg-blue-50 hover:bg-blue-100',
        compact && 'text-sm'
      )}
      style={{ height: rowHeight }}
      onClick={handleRowClick}
    >
      {selectable && (
        <div className="flex items-center justify-center w-12 px-2">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {columns.map((column) => {
        const value = getCellValue(item, column.key);

        return (
          <div
            key={String(column.key)}
            className={cn(
              'px-6 py-2 text-sm text-gray-900 border-l border-gray-100 flex items-center',
              column.className
            )}
            style={{
              width: column.width,
              minWidth: column.minWidth || (typeof column.width === 'number' ? column.width : undefined),
            }}
          >
            {column.render ? column.render(value, item, index) : String(value || '')}
          </div>
        );
      })}
    </div>
  );
}

// Memoized row component to prevent unnecessary re-renders
const VirtualTableRow = React.memo(VirtualTableRowComponent) as typeof VirtualTableRowComponent;

export function VirtualDataTable<T extends Record<string, any>>({
  data,
  columns,
  rowHeight = 60,
  containerHeight = 400,
  loading = false,
  error,
  emptyMessage = 'אין נתונים להצגה',
  className,
  onRowClick,
  onSort,
  onFilter,
  searchable = false,
  searchPlaceholder = 'חיפוש...',
  onSearch,
  selectable = false,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  getRowId = (item) => item.id,
  stickyHeader = true,
  zebra = true,
  compact = false,
}: VirtualDataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Calculate visible items based on scroll position
  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
    const endIndex = Math.min(data.length, startIndex + Math.ceil(containerHeight / rowHeight) + 10);
    
    return {
      startIndex,
      endIndex,
      items: data.slice(startIndex, endIndex),
    };
  }, [data, scrollTop, rowHeight, containerHeight]);

  // Handle scroll events with throttling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Sorting functionality
  const handleSort = (key: string) => {
    if (!columns.find(col => col.key === key)?.sortable) return;
    
    const direction = sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  // Filtering functionality
  const handleFilter = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    if (!value) delete newFilters[key];
    
    setFilters(newFilters);
    onFilter?.(newFilters);
  };

  // Search functionality with debounce
  useEffect(() => {
    if (!onSearch) return;
    
    const timeoutId = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, onSearch]);

  // Selection functionality
  const handleSelectAll = () => {
    const allSelected = selectedIds.size === data.length;
    onSelectAll?.(!allSelected);
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className={cn('border rounded-lg bg-white', className)}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner message="טוען נתונים..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('border border-red-200 rounded-lg bg-red-50 p-6', className)}>
        <div className="text-center">
          <div className="text-red-600 mb-2">❌</div>
          <p className="text-red-800 font-medium">שגיאה בטעינת הנתונים</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg bg-white overflow-hidden', className)}>
      {/* Search and Filters */}
      {(searchable || columns.some(col => col.filterable)) && (
        <div className="p-4 border-b bg-gray-50 space-y-3">
          {searchable && (
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  🔍
                </div>
              </div>
            </div>
          )}
          
          {columns.some(col => col.filterable) && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {columns
                .filter(col => col.filterable)
                .map((column) => (
                  <Input
                    key={String(column.key)}
                    type="text"
                    placeholder={`סנן ${column.header}`}
                    value={filters[String(column.key)] || ''}
                    onChange={(e) => handleFilter(String(column.key), e.target.value)}
                    className="text-sm"
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Selection Summary */}
      {selectable && selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b text-sm text-blue-800">
          נבחרו {selectedIds.size} מתוך {data.length} פריטים
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📄</div>
            <p>{emptyMessage}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden">
          {/* Header */}
          <div
            ref={headerRef}
            className={cn(
              'border-b bg-gray-50',
              stickyHeader && 'sticky top-0 z-10'
            )}
          >
            <div className="flex min-w-fit">
              {selectable && (
                <div className="flex items-center justify-center w-12 px-2 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedIds.size === data.length}
                    onChange={handleSelectAll}
                  />
                </div>
              )}
              
              {columns.map((column) => (
                <div
                  key={String(column.key)}
                  className={cn(
                    'px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-l border-gray-200',
                    column.headerClassName,
                    column.sortable && 'cursor-pointer hover:bg-gray-100 select-none'
                  )}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth || (typeof column.width === 'number' ? column.width : undefined),
                  }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center justify-between">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span className="text-gray-400 text-sm">
                        {getSortIcon(String(column.key))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Virtual Scroll Container */}
          <div
            ref={containerRef}
            className="overflow-auto"
            style={{ height: containerHeight }}
            onScroll={handleScroll}
          >
            {/* Spacer for items above viewport */}
            <div style={{ height: visibleItems.startIndex * rowHeight }} />
            
            {/* Visible Rows */}
            <div>
              {visibleItems.items.map((item, relativeIndex) => {
                const actualIndex = visibleItems.startIndex + relativeIndex;
                const rowId = getRowId(item);
                const isSelected = selectable && selectedIds.has(rowId);
                
                return (
                  <VirtualTableRow
                    key={rowId}
                    item={item}
                    columns={columns}
                    index={actualIndex}
                    rowHeight={rowHeight}
                    zebra={zebra}
                    compact={compact}
                    selectable={selectable}
                    isSelected={isSelected}
                    getRowId={getRowId}
                    onRowClick={onRowClick}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
            
            {/* Spacer for items below viewport */}
            <div style={{ height: (data.length - visibleItems.endIndex) * rowHeight }} />
          </div>
        </div>
      )}

      {/* Footer with row count */}
      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-600">
        סה״כ {data.length} פריטים
        {selectedIds.size > 0 && ` • ${selectedIds.size} נבחרו`}
      </div>
    </div>
  );
}

/* Usage Example:
import { VirtualDataTable } from '@/components/components/ui/VirtualDataTable';
import { Order, OrderStatus } from '@/components/lib/types';

const orderColumns: Column<Order>[] = [
  {
    key: 'number',
    header: 'מספר הזמנה',
    width: 120,
    sortable: true,
    render: (value) => `#${value}`
  },
  {
    key: 'customerName',
    header: 'שם לקוח',
    width: 200,
    sortable: true,
    filterable: true,
  },
  {
    key: 'status',
    header: 'סטטוס',
    width: 150,
    sortable: true,
    filterable: true,
    render: (status: OrderStatus) => <StatusBadge status={status} />
  },
  {
    key: 'totalAmount',
    header: 'סכום',
    width: 120,
    sortable: true,
    render: (amount) => formatCurrency(amount)
  },
  {
    key: 'createdAt',
    header: 'תאריך יצירה',
    width: 140,
    sortable: true,
    render: (date) => new Date(date).toLocaleDateString('he-IL')
  },
];

// In your component
<VirtualDataTable
  data={orders}
  columns={orderColumns}
  containerHeight={600}
  searchable
  selectable
  onRowClick={(order) => router.push(`/orders/${order.id}`)}
  onSearch={handleSearch}
  onSort={handleSort}
  onFilter={handleFilter}
/>
*/
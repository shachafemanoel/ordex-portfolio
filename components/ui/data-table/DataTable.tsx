'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/Loading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { DataTablePagination } from '@/components/ui/data-table/DataTablePagination';
import { DataTableRow } from '@/components/ui/data-table/DataTableRow';
import { DataTableToolbar } from '@/components/ui/data-table/DataTableToolbar';
import { DataTableProps } from '@/components/ui/data-table/types';

// Optimize filtering logic
const filterData = <T extends Record<string, any>>(
  data: T[],
  columns: any[],
  globalSearchTerm: string,
  localFilters: Record<string, any>
) => {
  let result = [...data];

  // Global Search
  if (globalSearchTerm) {
    const lowerSearchTerm = globalSearchTerm.toLowerCase();
    result = result.filter((item) =>
      columns.some((column) => {
        const value = item[String(column.key)];
        if (value == null) return false;
        const strValue = typeof value === 'string' ? value : String(value);
        return strValue.toLowerCase().includes(lowerSearchTerm);
      })
    );
  }

  // Column Filters
  const activeFilters = Object.entries(localFilters)
    .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => ({
      key,
      value,
      lowerValue: typeof value === 'string' ? value.toLowerCase() : undefined,
    }));

  if (activeFilters.length > 0) {
    result = result.filter((item) => {
      for (const { key, value, lowerValue } of activeFilters) {
        const itemValue = item[key];
        if (typeof value === 'string') {
          const strItemValue = typeof itemValue === 'string' ? itemValue : String(itemValue ?? '');
          if (!strItemValue.toLowerCase().includes(lowerValue!)) {
            return false;
          }
        } else if (itemValue !== value) {
          return false;
        }
      }
      return true;
    });
  }

  return result;
};

// Optimized with React.memo to prevent unnecessary re-renders
export const DataTable = React.memo(function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  getItemId = (item: T) => item.id || '',
  pagination,
  sortable = true,
  defaultSort,
  onSortChange,
  filterable = true,
  globalSearch = true,
  onFilterChange,
  actions = [],
  title,
  description,
  emptyMessage = 'לא נמצאו נתונים',
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(defaultSort || null);

  const [localFilters, setLocalFilters] = useState<Record<string, any>>({});
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Refs for stable callback
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  const selectedItemsRef = React.useRef(selectedItems);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    selectedItemsRef.current = selectedItems;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setIsMobile(false);
      return;
    }
    const mq = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setIsMobile(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Handle sorting
  const handleSort = (key: string) => {
    if (!sortable) return;

    const newDirection: 'asc' | 'desc' =
      localSort?.key === key && localSort.direction === 'asc' ? 'desc' : 'asc';

    const newSort = { key, direction: newDirection };
    setLocalSort(newSort);

    if (onSortChange) {
      onSortChange(key, newDirection);
    }
  };

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;

    if (checked) {
      const allIds = data.map(getItemId);
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  };

  // Create a Set for fast lookup of selected items
  // This improves performance from O(N*M) to O(N) when checking selection status in large lists
  const selectedItemsSet = useMemo(() => new Set(selectedItems), [selectedItems]);

  // Create selected items objects for the toolbar
  const selectedItemsObjects = useMemo(() => {
    return data.filter((item) => selectedItemsSet.has(getItemId(item)));
  }, [data, selectedItemsSet, getItemId]);

  // Stable callback for row selection
  const handleSelectItem = React.useCallback((itemId: string, checked: boolean) => {
    const currentSelected = selectedItemsRef.current;
    const onChange = onSelectionChangeRef.current;
    if (!onChange) return;

    if (checked) {
      onChange([...currentSelected, itemId]);
    } else {
      onChange(currentSelected.filter((id) => id !== itemId));
    }
  }, []);

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  // Filter and sort data locally if needed
  const processedData = useMemo(() => {
    const filtered = filterData(data, columns, globalSearchTerm, localFilters);

    // Apply sorting
    if (localSort && !onSortChange) {
      filtered.sort((a, b) => {
        const aVal = a[localSort.key];
        const bVal = b[localSort.key];

        if (aVal === bVal) return 0;

        const comparison = aVal < bVal ? -1 : 1;
        return localSort.direction === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, globalSearchTerm, localFilters, localSort, onSortChange, columns]);

  const isAllSelected = data.length > 0 && selectedItems.length === data.length;
  const isSomeSelected = selectedItems.length > 0 && selectedItems.length < data.length;

  const getSortIcon = (columnKey: string) => {
    if (localSort?.key !== columnKey) return '↕️';
    return localSort.direction === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    const skeletonColumns = Math.max(columns.length + (selectable ? 1 : 0), 4);
    const skeletonRows = pagination?.pageSize ?? 5;

    return (
      <Card className={className} aria-live="polite" aria-busy="true">
        {title && (
          <CardHeader>
            <CardTitle className="text-right text-text-primary">{title}</CardTitle>
            {description && <p className="text-sm text-text-secondary text-right">{description}</p>}
          </CardHeader>
        )}
        <CardContent className="p-4">
          <SkeletonTable rows={skeletonRows} columns={skeletonColumns} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8 text-center">
          <div className="text-destructive mb-2">
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className="font-semibold mb-2">שגיאה בטעינת הנתונים</h3>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <DataTableToolbar
          title={title}
          description={description}
          actions={actions}
          selectedItems={selectedItemsObjects}
          globalSearch={globalSearch}
          globalSearchTerm={globalSearchTerm}
          onGlobalSearchChange={setGlobalSearchTerm}
          filterable={filterable}
          columns={columns}
          localFilters={localFilters}
          onFilterChange={(newFilters) => {
            setLocalFilters(newFilters);
            onFilterChange?.(newFilters);
          }}
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
        />

        {/* Mobile Card View – Touch-optimized */}
        {isMobile && (
          <div className="md:hidden p-3 space-y-2.5">
            {processedData.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-gray-500">
                <div className="text-sm">{emptyMessage}</div>
              </div>
            ) : (
              processedData.map((item, index) => {
                const itemId = getItemId(item);
                const isSelected = selectedItemsSet.has(itemId);
                const CardComponent: React.ElementType = onRowClick ? 'button' : 'div';

                // First column is treated as the "title" for card header
                const titleColumn = columns[0];
                const detailColumns = columns.slice(1);

                return (
                  <CardComponent
                    key={itemId || index}
                    {...(onRowClick ? { type: 'button', onClick: () => onRowClick(item) } : {})}
                    className={`w-full rounded-xl border bg-white p-3.5 text-right shadow-sm transition-all duration-150 active:scale-[0.98] touch-manipulation ${
                      isSelected
                        ? 'ring-2 ring-primary/20 border-primary bg-primary-light/30'
                        : 'border-slate-200 hover:border-slate-300'
                    } ${onRowClick ? 'cursor-pointer' : 'cursor-default'} ${index === 0 && onRowClick ? 'swipe-hint' : ''}`}
                  >
                    {/* Card header: first column as title, larger text */}
                    {titleColumn && (
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-bold text-foreground truncate flex-1 min-w-0">
                          {titleColumn.render
                            ? titleColumn.render(item[String(titleColumn.key)], item, index)
                            : String(item[String(titleColumn.key)] || '-')}
                        </span>
                        {selectable && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectItem(itemId, e.target.checked);
                            }}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-5 w-5 shrink-0"
                            aria-label={`בחר ${itemId}`}
                          />
                        )}
                      </div>
                    )}

                    {/* Detail rows */}
                    <div className="space-y-1.5">
                      {detailColumns.map((column) => (
                        <div
                          key={String(column.key)}
                          className="flex items-start justify-between gap-3"
                        >
                          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                            {column.title}
                          </span>
                          <span className="text-xs text-foreground text-left truncate max-w-[60%]">
                            {column.render
                              ? column.render(item[String(column.key)], item, index)
                              : String(item[String(column.key)] || '-')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Tap indicator for clickable cards */}
                    {onRowClick && (
                      <div className="flex items-center justify-center mt-2 pt-2 border-t border-gray-100">
                        <span className="text-[10px] text-muted-foreground">
                          הקש לפרטים
                        </span>
                      </div>
                    )}
                  </CardComponent>
                );
              })
            )}
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el: HTMLInputElement | null) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 focus:ring-primary"
                      aria-label="בחר את כל השורות"
                    />
                  </TableHead>
                )}

                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    style={{ width: column.width }}
                    className={
                      column.sortable !== false && sortable
                        ? 'cursor-pointer hover:bg-muted/50'
                        : ''
                    }
                    onClick={() => column.sortable !== false && handleSort(String(column.key))}
                    tabIndex={column.sortable !== false && sortable ? 0 : undefined}
                    onKeyDown={(e) =>
                      column.sortable !== false &&
                      sortable &&
                      handleKeyDown(e, () => handleSort(String(column.key)))
                    }
                    aria-sort={
                      localSort?.key === column.key
                        ? localSort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{column.title}</span>
                      {column.sortable !== false && sortable && (
                        <span className="text-muted-foreground/50 w-4 h-4 flex items-center justify-center">
                          {getSortIcon(String(column.key))}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {processedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                processedData.map((item, index) => {
                  const itemId = getItemId(item);
                  const isSelected = selectedItemsSet.has(itemId);

                  return (
                    <DataTableRow
                      key={itemId || index}
                      item={item}
                      itemId={itemId}
                      index={index}
                      columns={columns}
                      isSelected={isSelected}
                      selectable={!!selectable}
                      onSelect={handleSelectItem}
                      onRowClick={onRowClick}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {pagination && (
          <div className="border-t">
            <DataTablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.onPageChange}
              onPageSizeChange={pagination.onPageSizeChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}) as <T extends Record<string, any>>(props: DataTableProps<T>) => React.ReactElement;

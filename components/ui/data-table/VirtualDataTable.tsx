'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SkeletonTable } from '@/components/ui/Loading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { DataTableRow } from '@/components/ui/data-table/DataTableRow';
import { DataTableToolbar } from '@/components/ui/data-table/DataTableToolbar';
import { DataTableProps } from '@/components/ui/data-table/types';

// Optimize filtering logic (Reused from DataTable)
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

interface VirtualDataTableProps<T> extends DataTableProps<T> {
  estimateRowHeight?: number;
  height?: number | string;
}

export const VirtualDataTable = React.memo(function VirtualDataTable<
  T extends Record<string, any>,
>({
  data,
  columns,
  loading = false,
  error,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  getItemId = (item: T) => item.id || '',
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
  estimateRowHeight = 53, // Default row height for compact table
  height = '600px',
}: VirtualDataTableProps<T>) {
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

  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  const selectedItemsSet = useMemo(() => new Set(selectedItems), [selectedItems]);

  const selectedItemsObjects = useMemo(() => {
    return data.filter((item) => selectedItemsSet.has(getItemId(item)));
  }, [data, selectedItemsSet, getItemId]);

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

  const processingData = useMemo(() => {
    const filtered = filterData(data, columns, globalSearchTerm, localFilters);

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

  const rowVirtualizer = useVirtualizer({
    count: processingData.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 20,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  const isAllSelected = data.length > 0 && selectedItems.length === data.length;
  const isSomeSelected = selectedItems.length > 0 && selectedItems.length < data.length;

  const getSortIcon = (columnKey: string) => {
    if (localSort?.key !== columnKey) return '↕️';
    return localSort.direction === 'asc' ? '↑' : '↓';
  };

  // Common padding logic for table virtualization
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1].end || 0) : 0;

  if (loading) {
    const skeletonColumns = Math.max(columns.length + (selectable ? 1 : 0), 4);
    const skeletonRows = 10;
    return (
      <Card className={className} aria-live="polite" aria-busy="true">
        {title && (
          <CardHeader>
            <CardTitle className="text-right">{title}</CardTitle>
            {description && <p className="text-sm text-gray-600 text-right">{description}</p>}
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
      <CardContent className="p-0 flex flex-col h-full">
        {/* Toolbar - Non scrollable */}
        <div className="shrink-0">
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
        </div>

        {/* Desktop Table View - Virtualized */}
        <div
          ref={tableContainerRef}
          style={{ height: typeof height === 'number' ? `${height}px` : height, overflowY: 'auto' }}
          className="relative w-full border-t"
        >
          <Table className="w-full table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-white shadow-sm ring-1 ring-gray-100">
              <TableRow>
                {selectable && (
                  <TableHead className="w-[50px] bg-gray-50/95 backdrop-blur">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el: HTMLInputElement | null) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 focus:ring-primary"
                    />
                  </TableHead>
                )}
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    style={{ width: column.width }}
                    className={`bg-gray-50/95 backdrop-blur ${
                      column.sortable !== false && sortable
                        ? 'cursor-pointer hover:bg-muted/50'
                        : ''
                    }`}
                    onClick={() => column.sortable !== false && handleSort(String(column.key))}
                    onKeyDown={(e) =>
                      column.sortable !== false &&
                      sortable &&
                      handleKeyDown(e, () => handleSort(String(column.key)))
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
              {paddingTop > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    style={{ height: `${paddingTop}px`, padding: 0 }}
                  />
                </TableRow>
              )}

              {processingData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
              {virtualRows.map((virtualRow) => {
                const item = processingData[virtualRow.index];
                const itemId = getItemId(item);
                const isSelected = selectedItemsSet.has(itemId);

                return (
                  <DataTableRow
                    key={virtualRow.key}
                    item={item}
                    itemId={itemId}
                    index={virtualRow.index}
                    columns={columns}
                    isSelected={isSelected}
                    selectable={!!selectable}
                    onSelect={handleSelectItem}
                    onRowClick={onRowClick}
                  />
                );
              })}

              {paddingBottom > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    style={{ height: `${paddingBottom}px`, padding: 0 }}
                  />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}) as <T extends Record<string, any>>(props: VirtualDataTableProps<T>) => React.ReactElement;

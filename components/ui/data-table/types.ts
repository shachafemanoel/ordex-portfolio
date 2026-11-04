import React from 'react';

export interface Column<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  renderFilter?: () => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string;

  // Selection
  selectable?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  getItemId?: (item: T) => string;

  // Pagination
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };

  // Sorting
  sortable?: boolean;
  defaultSort?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;

  // Filtering
  filterable?: boolean;
  globalSearch?: boolean;
  onFilterChange?: (filters: Record<string, any>) => void;

  // Actions
  actions?: {
    label: string;
    onClick: (items: T[]) => void;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
    icon?: React.ReactNode;
    disabled?: boolean;
  }[];
  // Row interaction
  onRowClick?: (item: T) => void;

  // Appearance
  title?: string;
  description?: string;
  emptyMessage?: string;
  className?: string;
}

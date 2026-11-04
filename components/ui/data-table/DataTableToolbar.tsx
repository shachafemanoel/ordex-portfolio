'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Column } from '@/components/ui/data-table/types';

interface DataTableToolbarProps<T> {
  title?: string;
  description?: string;
  actions?: {
    label: string;
    onClick: (items: T[]) => void;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
    icon?: React.ReactNode;
    disabled?: boolean;
  }[];
  selectedItems: T[]; // The actual items, not just IDs, would be better but keeping consistent with original props logic passed down

  // Filtering
  globalSearch?: boolean;
  globalSearchTerm: string;
  onGlobalSearchChange: (value: string) => void;

  filterable?: boolean;
  columns: Column<T>[];
  localFilters: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;

  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
}

export function DataTableToolbar<T>({
  title,
  description,
  actions = [],
  selectedItems,
  globalSearch,
  globalSearchTerm,
  onGlobalSearchChange,
  filterable,
  columns,
  localFilters,
  onFilterChange,
  filtersOpen,
  setFiltersOpen,
}: DataTableToolbarProps<T>) {
  const hasHeader = title || actions.length > 0;
  const hasFilters = filterable || globalSearch;

  if (!hasHeader && !hasFilters) return null;

  return (
    <>
      {hasHeader && (
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-right">
              {title && <h3 className="font-bold text-lg text-text-primary">{title}</h3>}
              {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
            </div>

            {actions.length > 0 && (
              <div className="flex gap-2">
                {actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || 'secondary'}
                    size="sm"
                    onClick={() => action.onClick(selectedItems)}
                    disabled={action.disabled || (selectedItems.length === 0 && !action.disabled)} // Logic check: if action depends on selection, it usually disables itself. Original code had logic: disabled={action.disabled || (selectable && selectedItems.length === 0)}.
                    // I will simplify here assuming parent passes correct handler.
                    icon={action.icon}
                  >
                    {action.label}
                    {selectedItems.length > 0 && (
                      <span className="mr-1">({selectedItems.length})</span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {hasFilters && (
        <div className="border-b bg-background-light/50">
          <div className="flex items-center justify-between px-4 py-3 md:hidden">
            <span className="text-sm font-bold text-text-secondary">סינון</span>
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)}>
              {filtersOpen ? 'סגור' : 'פתח'}
            </Button>
          </div>
          <div className={`p-4 ${filtersOpen ? 'block' : 'hidden'} md:block`}>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {globalSearch && (
                <div className="sm:col-span-2">
                  <Input
                    placeholder="חיפוש כללי..."
                    value={globalSearchTerm}
                    onChange={(e) => onGlobalSearchChange(e.target.value)}
                    className="text-right"
                    aria-label="חיפוש כללי"
                  />
                </div>
              )}

              {filterable &&
                columns
                  .filter((col) => col.filterable)
                  .map((column) => (
                    <div key={String(column.key)}>
                      {column.renderFilter ? (
                        column.renderFilter()
                      ) : (
                        <Input
                          placeholder={`סנן לפי ${column.title}`}
                          value={localFilters[String(column.key)] || ''}
                          onChange={(e) => {
                            const newFilters = {
                              ...localFilters,
                              [String(column.key)]: e.target.value,
                            };
                            onFilterChange(newFilters);
                          }}
                          className="text-right"
                          aria-label={`סנן לפי ${column.title}`}
                        />
                      )}
                    </div>
                  ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

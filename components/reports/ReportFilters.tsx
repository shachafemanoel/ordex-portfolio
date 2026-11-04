'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';

interface ReportFiltersProps {
  onFilterChange: (filters: ReportFilters) => void;
  onClearFilters: () => void;
  showStatusFilter?: boolean;
  showDateFilter?: boolean;
  showSupplierFilter?: boolean;
  showUserFilter?: boolean;
  currentUserId?: string;
  allowAllUsers?: boolean;
  defaultFilters?: ReportFilters;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  supplierId?: string;
  userId?: string;
}

import { ORDER_STATUS_CONFIG } from '@/lib/orderStatus';

const statusOptions = [
  { value: '', label: 'כל הסטטוסים' },
  ...Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label,
  })),
];

export function ReportFilters({
  onFilterChange,
  onClearFilters,
  showStatusFilter = true,
  showDateFilter = true,
  showSupplierFilter = false, // Currently unused but needed for future feature
  showUserFilter = false,
  currentUserId,
  allowAllUsers = false,
  defaultFilters,
}: ReportFiltersProps) {
  // Suppress unused variable warning for future use
  void showSupplierFilter;
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters ?? {});

  useEffect(() => {
    setFilters(defaultFilters ?? {});
  }, [defaultFilters]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleUserFilterChange = (value: string) => {
    if (!currentUserId) {
      return;
    }

    const resolvedValue = value === 'all' ? undefined : value || currentUserId;
    const newFilters = { ...filters, userId: resolvedValue };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const resetFilters: ReportFilters = defaultFilters ?? {};
    setFilters(resetFilters);
    onClearFilters();
  };

  const hasActiveFilters = Object.values(filters).some((value) => value);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-4 md:grid-cols-4">
          {showDateFilter && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dateFrom">מתאריך</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">עד תאריך</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
            </>
          )}

          {showStatusFilter && (
            <div className="space-y-2">
              <Label htmlFor="status">סטטוס</Label>
              <Select
                id="status"
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {showUserFilter && currentUserId && (
            <div className="space-y-2">
              <Label htmlFor="report-user">משתמש</Label>
              <Select
                id="report-user"
                value={filters.userId ?? (allowAllUsers ? 'all' : currentUserId)}
                onChange={(e) => handleUserFilterChange(e.target.value)}
              >
                {allowAllUsers && <option value="all">כל המשתמשים</option>}
                <option value={currentUserId}>ההזמנות שלי</option>
              </Select>
            </div>
          )}

          <div className="flex items-end space-x-2 space-x-reverse">
            <Button
              onClick={handleClearFilters}
              variant="outline"
              className="flex-1"
              disabled={!hasActiveFilters}
            >
              נקה מסננים
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

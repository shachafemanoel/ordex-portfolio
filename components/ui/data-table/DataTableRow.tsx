import { cn } from '@/lib/utils';
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/Table';
import { Column } from '@/components/ui/data-table/types';

interface DataTableRowProps<T> {
  item: T;
  itemId: string;
  index: number;
  columns: Column<T>[];
  isSelected: boolean;
  selectable: boolean;
  onSelect: (itemId: string, checked: boolean) => void;
  onRowClick?: (item: T) => void;
}

const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};

function DataTableRowInternal<T extends Record<string, any>>({
  item,
  itemId,
  index,
  columns,
  isSelected,
  selectable,
  onSelect,
  onRowClick,
}: DataTableRowProps<T>) {
  return (
    <TableRow
      className={cn(
        isSelected && 'bg-primary-light/50',
        onRowClick && 'cursor-pointer',
        'transition-all'
      )}
      onClick={() => onRowClick?.(item)}
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={(e) => onRowClick && handleKeyDown(e, () => onRowClick(item))}
      aria-selected={isSelected}
      data-state={isSelected ? 'selected' : undefined}
    >
      {selectable && (
        <TableCell className="w-[50px]">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onSelect(itemId, e.target.checked)}
            className="rounded border-slate-300 text-primary focus:ring-primary"
            aria-label={`בחר שורה ${index + 1}`}
          />
        </TableCell>
      )}

      {columns.map((column) => (
        <TableCell key={String(column.key)} className="whitespace-nowrap">
          {column.render
            ? column.render(item[String(column.key)], item, index)
            : String(item[String(column.key)] || '-')}
        </TableCell>
      ))}
    </TableRow>
  );
}

// We need to cast React.memo result to a generic component type to preserve the generic T
export const DataTableRow = React.memo(DataTableRowInternal) as <T extends Record<string, any>>(
  props: DataTableRowProps<T>
) => React.ReactElement;

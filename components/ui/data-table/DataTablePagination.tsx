'use client';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  return (
    <div className="px-4 md:px-6 py-3 border-t bg-background-light flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center text-xs md:text-sm text-text-secondary w-full sm:w-auto justify-center sm:justify-start">
        <p aria-live="polite">
          מציג {(currentPage - 1) * pageSize + 1} עד {Math.min(currentPage * pageSize, totalItems)}{' '}
          מתוך {totalItems} רשומות
        </p>

        {onPageSizeChange && (
          <div className="mr-4 hidden md:flex items-center">
            <label htmlFor="pageSize" className="ml-2">
              רשומות בעמוד:
            </label>
            <Select
              id="pageSize"
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
              options={[
                { value: '10', label: '10' },
                { value: '20', label: '20' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
              ]}
              className="w-20 h-9 md:h-10"
            />
          </div>
        )}
      </div>

      <nav aria-label="Pagination" className="flex items-center gap-1.5 md:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="עבור לעמוד הקודם"
          className="touch-manipulation"
        >
          הקודם
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + Math.max(1, currentPage - 2);
            if (page > totalPages) return null;

            return (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(page)}
                className="w-10 h-10 md:w-8 md:h-8 p-0 touch-manipulation"
                aria-label={`עבור לעמוד ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="עבור לעמוד הבא"
          className="touch-manipulation"
        >
          הבא
        </Button>
      </nav>
    </div>
  );
}

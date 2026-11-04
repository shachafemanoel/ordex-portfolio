'use client';

import { cn } from '@/lib/utils';
import React from 'react';

export interface FilterPill {
  key: string;
  label: string;
  count?: number | null;
}

interface FilterPillsProps {
  items: FilterPill[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export function FilterPills({ items, activeKey, onChange, className }: FilterPillsProps) {
  return (
    <div
      className={cn(
        // Scrollable on mobile for many pills
        'flex items-center gap-1.5 bg-gray-100 rounded-xl p-1 border border-gray-200',
        'overflow-x-auto no-scrollbar',
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              // Touch-friendly: min 44px height, no-wrap, instant tap
              'relative inline-flex items-center gap-2 px-4 py-2.5 md:py-2 rounded-lg text-sm font-semibold transition-all',
              'whitespace-nowrap touch-manipulation select-none active:scale-95 min-h-[44px]',
              'shrink-0',
              isActive
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            )}
          >
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'count inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full text-[12px] font-semibold',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-gray-200 text-gray-600'
                )}
              >
                {item.count}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}


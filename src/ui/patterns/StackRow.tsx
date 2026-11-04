'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StackRowItemButton } from '@/src/ui/patterns/StackRowItemButton';

interface StackRowItem {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  /** Trailing compact chip (e.g. weekday or time) */
  metaEnd?: string | null;
  urgent?: boolean;
}

interface StackRowProps {
  /** Total remaining count (excluding top-1) */
  count: number;
  /** Items to show when expanded (may be a subset if queue is huge) */
  items: StackRowItem[];
  /** Called when user clicks on an individual item */
  onItemClick?: (id: string) => void;
}

/**
 * Collapsed "+N more" row that toggles expanded/collapsed state inline to show queue items.
 */
export function StackRow({ count, items, onItemClick }: StackRowProps) {
  const [expanded, setExpanded] = useState(false);

  if (count <= 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-primary)] bg-surface-muted/50 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-muted hover:text-brand"
      >
        <span>{expanded ? 'סגור' : `הצג את כל ${count} ההזמנות הנוספות ←`}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>

      {expanded && items.length > 0 && (
        <ul className="divide-y divide-[color:var(--color-border-primary)] animate-in fade-in slide-in-from-top-1 duration-150">
          {items.map((item) => (
            <li key={item.id}>
              <StackRowItemButton
                id={item.id}
                title={item.title ?? item.label ?? 'ללא כותרת'}
                description={item.description}
                metaEnd={item.metaEnd}
                urgent={item.urgent}
                onItemClick={onItemClick}
              />
            </li>
          ))}
          {count > items.length && (
            <li className="px-4 py-2 text-xs text-fg-subtle">
              +{count - items.length} נוספות לא מוצגות
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

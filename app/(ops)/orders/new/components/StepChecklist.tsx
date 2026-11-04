'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

interface StepChecklistProps {
  title: string;
  items: ChecklistItem[];
  className?: string;
}

export function StepChecklist({ title, items, className }: StepChecklistProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-subtle bg-surface-muted/80 p-4 sm:p-5',
        className
      )}
      aria-label={title}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-fg-muted">{title}</h4>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-fg-muted">
          {items.filter((item) => item.done).length}/{items.length}
        </span>
      </div>

      <ul className="grid gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
              item.done ? 'tone-success' : 'bg-surface text-fg-muted'
            )}
          >
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-fg-subtle" />
            )}
            <span className="font-medium">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

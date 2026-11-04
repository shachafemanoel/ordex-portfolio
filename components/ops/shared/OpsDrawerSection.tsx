'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { ReactNode } from 'react';

interface OpsDrawerSectionProps {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: (id: string) => void;
  accentClassName?: string;
  children: ReactNode;
  className?: string;
}

export function OpsDrawerSection({
  id,
  title,
  summary,
  open,
  onToggle,
  accentClassName = 'bg-slate-400',
  children,
  className,
}: OpsDrawerSectionProps) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={cn(
          'flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-right transition-colors',
          open ? 'border-b border-slate-100' : 'hover:bg-slate-50'
        )}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', accentClassName)} />
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{summary}</p>
        </div>

        <ChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform',
            open ? 'rotate-180' : 'rotate-0'
          )}
        />
      </button>

      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}

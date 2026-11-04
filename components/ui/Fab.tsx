'use client';

import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';
import { LucideIcon, Plus, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

export interface FabAction {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

interface FabProps {
  actions: FabAction[];
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
  primary: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
};

export function Fab({ actions, className }: FabProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            // Larger touch target (56px), positioned above bottom nav on mobile
            'fixed bottom-24 md:bottom-8 end-4 md:end-6 z-[var(--z-fixed)]',
            'flex h-14 w-14 items-center justify-center rounded-full',
            'bg-[var(--color-primary-600)] text-on-dark',
            'shadow-lg shadow-primary-500/30',
            'transition-all duration-200',
            'hover:bg-[var(--color-primary-700)] hover:shadow-xl',
            'active:scale-90 touch-manipulation select-none',
            isOpen && 'rotate-45 bg-slate-700 hover:bg-slate-800 shadow-slate-500/20',
            className
          )}
          aria-label="פעולות מהירות"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={16}
          className="z-[var(--z-popover)] animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex flex-col gap-2.5 min-w-[220px]">
            {actions.map((action) => {
              const Icon = action.icon;
              const content = (
                <div
                  className={cn(
                    // Touch-optimized: minimum 48px height, generous padding
                    'flex items-center gap-3 rounded-xl border px-4 py-3.5',
                    'text-sm font-medium shadow-md',
                    'transition-all duration-150 active:scale-[0.97]',
                    'cursor-pointer touch-manipulation select-none',
                    'min-h-[48px]',
                    variantStyles[action.variant || 'default']
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{action.label}</span>
                </div>
              );

              if (action.href) {
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    onClick={() => setIsOpen(false)}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={action.id}
                  onClick={() => {
                    action.onClick?.();
                    setIsOpen(false);
                  }}
                  className="text-start"
                >
                  {content}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

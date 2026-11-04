'use client';

import React from 'react';
import { X, CheckCircle, Printer, RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface BulkAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  actions?: BulkAction[]; // Optional custom actions, otherwise defaults
}

export function BulkActionsBar({ selectedCount, onClear, actions }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full bg-surface-inverse px-6 py-3 text-on-dark shadow-xl shadow-slate-900/20 animate-in slide-in-from-bottom-4 duration-300">

      {/* Counter & Clear */}
      <div className="flex items-center gap-3 border-r border-white/20 pr-4">
        <span className="text-sm font-semibold text-on-dark">
          {selectedCount} נבחרו
        </span>
        <button
          onClick={onClear}
          className="rounded-full p-1 text-on-dark-muted hover:bg-white/10 hover:text-on-dark transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-on-dark border-0 gap-2 h-9 rounded-full px-4"
        >
          <CheckCircle className="h-4 w-4" />
          סמן כמוכן
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="bg-slate-800 text-on-dark-muted hover:bg-slate-700 hover:text-on-dark border-0 gap-2 h-9 rounded-full px-4"
        >
          <Printer className="h-4 w-4" />
          הדפס ליקוט
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="bg-slate-800 text-on-dark-muted hover:bg-slate-700 hover:text-on-dark border-0 gap-2 h-9 rounded-full px-4"
        >
          <RefreshCw className="h-4 w-4" />
          סטטוס
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="bg-slate-800 text-on-dark-muted hover:bg-slate-700 hover:text-on-dark border-0 gap-2 h-9 rounded-full px-4"
        >
          <Truck className="h-4 w-4" />
          שייך נהג
        </Button>
      </div>
    </div>
  );
}

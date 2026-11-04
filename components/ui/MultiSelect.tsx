'use client';

import { cn } from '@/lib/utils';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface Option {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'בחר...',
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  const selectedLabels = selected
    .map((val) => options.find((opt) => opt.value === val)?.label)
    .filter(Boolean);

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <div
        className={cn(
          'flex min-h-[56px] md:min-h-[48px] w-full items-center justify-between rounded-none border-[3px] border-black dark:border-white bg-white dark:bg-[#1e293b] px-4 py-2 text-sm transition-all',
          'cursor-pointer outline-none focus:border-[#0055ff] focus:shadow-[4px_4px_0px_0px_rgba(0,85,255,1)] focus:-translate-x-[1px] focus:-translate-y-[1px]',
          isOpen && 'border-[#0055ff] shadow-[4px_4px_0px_0px_rgba(0,85,255,1)] -translate-x-[1px] -translate-y-[1px]',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1">
          {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.length > 3 ? (
                <span className="bg-[#fbbf24] text-black border-2 border-black font-black px-2 py-0.5 text-[10px] uppercase tracking-tighter">
                  {selected.length} נבחרו
                </span>
              ) : (
                selected.map((val) => {
                  const label = options.find((o) => o.value === val)?.label;
                  return (
                    <span
                      key={val}
                      className="bg-white dark:bg-slate-800 text-black dark:text-white border-2 border-black dark:border-white px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5"
                    >
                      {label}
                      <button
                        type="button"
                        className="cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors p-0.5 -me-1 rounded-none touch-manipulation min-w-[20px] min-h-[20px] inline-flex items-center justify-center"
                        onClick={(e) => handleRemove(val, e)}
                      >
                        <X className="h-3 w-3" strokeWidth={3} />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
          )}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 max-h-60 w-full overflow-auto rounded-none border-[3px] border-black dark:border-white bg-white dark:bg-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-1">
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <div
                key={option.value}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-none px-4 py-3 text-xs font-black uppercase tracking-tighter outline-none transition-colors hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black min-h-[48px] touch-manipulation',
                  isSelected ? 'bg-slate-100 dark:bg-slate-800' : ''
                )}
                onClick={() => handleSelect(option.value)}
              >
                <div
                  className={cn(
                    'me-3 flex h-5 w-5 items-center justify-center rounded-none border-2 border-black dark:border-white',
                    isSelected
                      ? 'bg-[#0055ff] border-black text-white'
                      : 'bg-white dark:bg-slate-700'
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5', isSelected ? 'opacity-100' : 'opacity-0')} strokeWidth={4} />
                </div>
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

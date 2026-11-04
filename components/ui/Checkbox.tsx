'use client';

import { Check } from 'lucide-react';
import * as React from 'react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
      onChange?.(e);
    };

    return (
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className="peer h-5 w-5 shrink-0 appearance-none rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] outline-none transition-all ring-offset-background checked:border-[var(--color-primary-600)] checked:bg-[var(--color-primary-600)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)]/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer touch-manipulation"
          ref={ref}
          onChange={handleChange}
          {...props}
        />
        <Check
          className="pointer-events-none absolute left-[2px] top-[2px] h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3}
        />
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };

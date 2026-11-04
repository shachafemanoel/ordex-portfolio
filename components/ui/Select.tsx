import { cn } from '@/lib/utils';
import { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  errorId?: string;
  options?: SelectOption[];
  placeholder?: string;
  onValueChange?: (value: string) => void;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      error,
      errorId,
      children,
      options,
      placeholder,
      onValueChange,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (typeof onValueChange === 'function') {
        onValueChange(e.target.value);
      }
      if (typeof onChange === 'function') {
        onChange(e);
      }
    };

    return (
      <select
        className={cn(
          'flex w-full rounded-none border-[3px] border-black dark:border-white bg-white dark:bg-slate-900 px-4 py-2.5 ring-offset-background transition-all outline-none',
          'h-14 md:h-12',
          'text-base font-black uppercase tracking-tighter text-black dark:text-white',
          'placeholder:text-slate-400 font-bold italic',
          'focus:border-[#0055ff] focus:shadow-[4px_4px_0px_0px_rgba(0,85,255,1)] focus:-translate-x-[2px] focus:-translate-y-[2px]',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800',
          error && 'border-[#ff0033] focus:border-[#ff0033] focus:shadow-[4px_4px_0px_0px_rgba(255,0,51,1)]',
          className
        )}
        ref={ref}
        value={value}
        onChange={handleChange}
        aria-invalid={error}
        aria-describedby={errorId}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-[var(--color-text-tertiary)]">
            {placeholder}
          </option>
        )}
        {options
          ? options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] py-2"
              >
                {option.label}
              </option>
            ))
          : children}
      </select>
    );
  }
);
Select.displayName = 'Select';

export { Select };

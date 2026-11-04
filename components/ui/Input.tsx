import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorId?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, errorId, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--card-bg)] px-4 py-2 ring-offset-background transition-[border-color,box-shadow,background-color] outline-none',
          'h-11 md:h-12',
          'text-base font-medium text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-[var(--color-text-muted)]',
          'focus:border-[var(--color-primary-600)] focus:shadow-[0_0_0_3px_rgba(0,101,194,0.16)]',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-neutral-100)]',
          error &&
            'border-[var(--color-danger-500)] focus:border-[var(--color-danger-500)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.16)]',
          className
        )}
        ref={ref}
        aria-invalid={error}
        aria-describedby={errorId}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };

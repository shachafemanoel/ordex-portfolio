import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  errorId?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, errorId, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Touch-friendly textarea: larger min height, comfortable padding, rounded
          'flex min-h-[100px] w-full rounded-xl border bg-[var(--color-bg-primary)] px-4 py-3',
          // 16px on mobile prevents iOS zoom, 14px on desktop
          'text-base md:text-sm text-[var(--color-text-primary)]',
          'placeholder:text-[var(--color-text-tertiary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]/20 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-bg-secondary)]',
          'resize-vertical',
          'transition-all shadow-sm',
          error
            ? 'border-[var(--color-border-error)] focus:border-[var(--color-border-error)] focus:ring-[var(--color-border-error)]'
            : 'border-[var(--color-border-primary)] focus:border-[var(--color-border-focus)]',
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
Textarea.displayName = 'Textarea';

export { Textarea };
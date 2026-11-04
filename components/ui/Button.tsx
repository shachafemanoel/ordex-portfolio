import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

const buttonVariants = cva(
  'relative inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold ring-offset-background transition-[transform,box-shadow,background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-600)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none touch-manipulation active:scale-[0.96]',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-primary-700)] hover:shadow-[0_10px_15px_-3px_rgba(0,101,194,0.28)]',
        destructive:
          'bg-[var(--color-danger-600)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-danger-700)] hover:shadow-[0_10px_15px_-3px_rgba(220,38,38,0.28)]',
        outline:
          'border-[var(--color-primary-200)] bg-transparent text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]',
        secondary:
          'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]',
        ghost:
          'shadow-none hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]',
        link: 'min-h-0 rounded-md border-none p-0 shadow-none text-[var(--color-primary-600)] underline-offset-4 hover:text-[var(--color-primary-700)] hover:underline',
        success:
          'bg-[var(--color-success-600)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-success-700)] hover:shadow-[0_10px_15px_-3px_rgba(5,150,105,0.24)]',
        warning:
          'bg-[var(--color-warning-600)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-warning-700)] hover:shadow-[0_10px_15px_-3px_rgba(217,119,6,0.24)]',
        info:
          'bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-primary-600)] hover:shadow-[0_10px_15px_-3px_rgba(0,133,255,0.24)]',
        primary:
          'bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-primary-700)] hover:shadow-[0_10px_15px_-3px_rgba(0,101,194,0.28)]',
        danger:
          'bg-[var(--color-danger-600)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-danger-700)] hover:shadow-[0_10px_15px_-3px_rgba(220,38,38,0.28)]',
      },
      size: {
        default: 'h-11 md:h-12 px-6 py-2.5',
        sm: 'h-9 md:h-10 px-4',
        lg: 'h-13 md:h-14 px-10 text-base',
        icon: 'h-11 w-11 md:h-12 md:w-12',
        xs: 'h-8 md:h-9 px-3 text-xs',
        xl: 'h-16 md:h-18 px-12 text-lg',
        md: 'h-11 md:h-12 px-6 py-2.5',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading,
      icon,
      iconPosition = 'left',
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={props.disabled || loading}
        aria-disabled={props.disabled || loading}
        aria-busy={loading}
        {...props}
      >
        <span className="inline-flex items-center gap-2">
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            icon && iconPosition === 'left' && <span className="inline-flex shrink-0">{icon}</span>
          )}

          <span className="inline-flex items-center">{children}</span>

          {icon && !loading && iconPosition === 'right' && (
            <span className="inline-flex shrink-0">{icon}</span>
          )}
        </span>
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

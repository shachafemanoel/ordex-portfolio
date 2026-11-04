import { cn } from '@/lib/utils';
import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'ordex' | 'panel' | 'brutal';
  /** Adds a left-edge status stripe */
  statusColor?: 'blue' | 'green' | 'amber' | 'orange' | 'red' | 'purple' | 'gray';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'ordex', statusColor, ...props }, ref) => {
    const variants = {
      default:
        'app-card-premium overflow-hidden',
      ordex:
        'app-card-premium overflow-hidden p-[clamp(12px,2.5vw,20px)]',
      panel:
        'overflow-hidden rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-sm)]',
      brutal:
        'app-card-premium overflow-hidden border-[var(--color-primary-200)] shadow-[var(--shadow-md)]',
    };

    const statusBarClass = statusColor ? `status-bar-${statusColor}` : undefined;

    return (
      <div
        ref={ref}
        className={cn(variants[variant], statusBarClass, className)}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5 p-[clamp(16px,2.5vw,24px)]',
        className
      )}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-semibold leading-tight text-[var(--color-text-primary)] tracking-[-0.02em]',
        className
      )}
      style={{ fontSize: 'var(--font-heading-md)' }}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-[var(--color-text-secondary)]', className)}
    style={{ fontSize: 'var(--font-body)' }}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-[clamp(12px,2.5vw,20px)] pt-0', className)}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 border-t border-[var(--color-border-primary)]/80 p-[clamp(10px,2vw,16px)]',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

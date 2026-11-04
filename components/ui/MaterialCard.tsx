import { cn } from '@/lib/utils';
import React from 'react';

export interface MaterialCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined' | 'filled';
  interactive?: boolean;
}

export function MaterialCard({
  className,
  variant = 'elevated',
  interactive = false,
  children,
  ...props
}: MaterialCardProps) {
  const baseStyles = 'rounded-xl overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]';

  const variants = {
    elevated: 'bg-surface shadow-elevation-1 border border-transparent',
    outlined: 'bg-surface border border-border shadow-none',
    filled: 'bg-surface-highlight border-none shadow-none',
  };

  const interactiveStyles = interactive
    ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-elevation-3 active:scale-[0.99] active:shadow-elevation-1'
    : '';

  return (
    <div
      className={cn(baseStyles, variants[variant], interactiveStyles, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function MaterialCardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4 pb-2 md:p-6 md:pb-3', className)} {...props}>
      {children}
    </div>
  );
}

export function MaterialCardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-semibold leading-none tracking-tight text-primary', className)} {...props}>
      {children}
    </h3>
  );
}

export function MaterialCardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4 pt-0 md:p-6 md:pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function MaterialCardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center p-4 pt-0 md:p-6 md:pt-0', className)} {...props}>
      {children}
    </div>
  );
}

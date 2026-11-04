import { cn } from '@/lib/utils';
import React from 'react';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  centerContent?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

const paddingClasses = {
  none: '',
  sm: 'px-4 py-2',
  md: 'px-6 py-4',
  lg: 'px-8 py-6',
};

export function ResponsiveContainer({
  children,
  className = '',
  maxWidth = 'full',
  padding = 'md',
  centerContent = false,
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        'w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        centerContent && 'mx-auto',
        className
      )}
    >
      {children}
    </div>
  );
}

// Mobile-first responsive grid
interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    base?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg';
}

const gapClasses = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

export function ResponsiveGrid({
  children,
  className = '',
  cols = { base: 1, md: 2, lg: 3 },
  gap = 'md',
}: ResponsiveGridProps) {
  const gridClasses = [];

  if (cols.base) gridClasses.push(`grid-cols-${cols.base}`);
  if (cols.sm) gridClasses.push(`sm:grid-cols-${cols.sm}`);
  if (cols.md) gridClasses.push(`md:grid-cols-${cols.md}`);
  if (cols.lg) gridClasses.push(`lg:grid-cols-${cols.lg}`);
  if (cols.xl) gridClasses.push(`xl:grid-cols-${cols.xl}`);

  return <div className={cn('grid', gapClasses[gap], ...gridClasses, className)}>{children}</div>;
}

// Responsive stack for vertical layouts
interface ResponsiveStackProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

const spacingClasses = {
  none: 'space-y-0',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6',
  xl: 'space-y-8',
};

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function ResponsiveStack({
  children,
  className = '',
  spacing = 'md',
  align = 'stretch',
}: ResponsiveStackProps) {
  return (
    <div className={cn('flex flex-col', spacingClasses[spacing], alignClasses[align], className)}>
      {children}
    </div>
  );
}

// Responsive flex container
interface ResponsiveFlexProps {
  children: React.ReactNode;
  className?: string;
  direction?: {
    base?: 'row' | 'col';
    sm?: 'row' | 'col';
    md?: 'row' | 'col';
    lg?: 'row' | 'col';
  };
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'center' | 'end' | 'stretch';
  gap?: 'none' | 'sm' | 'md' | 'lg';
  wrap?: boolean;
}

const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const alignFlexClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function ResponsiveFlex({
  children,
  className = '',
  direction = { base: 'row' },
  justify = 'start',
  align = 'center',
  gap = 'md',
  wrap = false,
}: ResponsiveFlexProps) {
  const directionClasses = [];

  if (direction.base) directionClasses.push(direction.base === 'row' ? 'flex-row' : 'flex-col');
  if (direction.sm) directionClasses.push(direction.sm === 'row' ? 'sm:flex-row' : 'sm:flex-col');
  if (direction.md) directionClasses.push(direction.md === 'row' ? 'md:flex-row' : 'md:flex-col');
  if (direction.lg) directionClasses.push(direction.lg === 'row' ? 'lg:flex-row' : 'lg:flex-col');

  return (
    <div
      className={cn(
        'flex',
        ...directionClasses,
        justifyClasses[justify],
        alignFlexClasses[align],
        gapClasses[gap],
        wrap && 'flex-wrap',
        className
      )}
    >
      {children}
    </div>
  );
}

// Hide/show on different breakpoints
interface ResponsiveVisibilityProps {
  children: React.ReactNode;
  hideOn?: ('sm' | 'md' | 'lg' | 'xl')[];
  showOnlyOn?: ('sm' | 'md' | 'lg' | 'xl')[];
  className?: string;
}

export function ResponsiveVisibility({
  children,
  hideOn = [],
  showOnlyOn = [],
  className = '',
}: ResponsiveVisibilityProps) {
  const visibilityClasses = [];

  // Handle hideOn
  hideOn.forEach((breakpoint) => {
    visibilityClasses.push(`${breakpoint}:hidden`);
  });

  // Handle showOnlyOn (more complex logic)
  if (showOnlyOn.length > 0) {
    // Start with hidden, then show on specified breakpoints
    visibilityClasses.push('hidden');
    showOnlyOn.forEach((breakpoint) => {
      visibilityClasses.push(`${breakpoint}:block`);
    });
  }

  return <div className={cn(...visibilityClasses, className)}>{children}</div>;
}

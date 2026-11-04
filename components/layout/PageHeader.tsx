'use client';

import { cn } from '@/lib/utils';
import { PageScaffoldHeader } from '@/components/layout/shell/PageScaffold';
import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
  children,
}: PageHeaderProps) {
  return (
    <PageScaffoldHeader
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={
        actions || children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 self-start lg:self-start">
            {actions}
            {children}
          </div>
        ) : undefined
      }
      className={cn('mb-[var(--app-shell-gap)]', className)}
    />
  );
}

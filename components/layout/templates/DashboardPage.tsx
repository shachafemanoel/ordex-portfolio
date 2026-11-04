'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { PageScaffold } from '@/components/layout/shell/PageScaffold';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface DashboardPageProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DashboardPage({
  title = 'לוח בקרה',
  actions,
  children,
  className,
}: DashboardPageProps) {
  return (
    <PageScaffold className={cn(className)}>
      <PageHeader title={title} actions={actions} />
      <div className="grid gap-6">{children}</div>
    </PageScaffold>
  );
}

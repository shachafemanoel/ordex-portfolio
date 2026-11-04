'use client';

import { DisplaySemanticBadge } from '@/components/ui/display-templates';
import { BadgeCount } from '@/src/ui/patterns/BadgeCount';

interface QueueSectionHeaderProps {
  title: string;
  count: number;
  urgentCount: number;
}

export function QueueSectionHeader({
  title,
  count,
  urgentCount,
}: Readonly<QueueSectionHeaderProps>) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-xs font-black uppercase tracking-[0.08em] text-ops-muted">
            {title}
          </h3>
          <BadgeCount count={count} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <DisplaySemanticBadge tone="info" className="text-[10px] font-black">
            ההזמנה הבאה לביצוע
          </DisplaySemanticBadge>
          {urgentCount > 0 ? (
            <DisplaySemanticBadge tone="warning" className="text-[10px] font-black">
              {urgentCount} דחופות
            </DisplaySemanticBadge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

'use client';

import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { cn } from '@/lib/utils';

interface StackRowItemButtonProps {
  id: string;
  title: string;
  description?: string;
  metaEnd?: string | null;
  urgent?: boolean;
  onItemClick?: (id: string) => void;
}

export function StackRowItemButton({
  id,
  title,
  description,
  metaEnd,
  urgent,
  onItemClick,
}: Readonly<StackRowItemButtonProps>) {
  const isItemClickable = typeof onItemClick === 'function';

  return (
    <button
      type="button"
      onClick={() => onItemClick?.(id)}
      disabled={!isItemClickable}
      aria-disabled={!isItemClickable}
      className={cn(
        'flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition-colors',
        isItemClickable ? 'cursor-pointer hover:bg-surface-muted' : 'cursor-default'
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-fg">{title}</div>
        {description ? (
          <div className="mt-0.5 truncate text-xs font-medium text-fg-muted">{description}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {metaEnd ? (
          <span className="inline-flex min-h-[24px] min-w-[2rem] items-center justify-center rounded-md bg-primary-600 px-2 py-0.5 text-[10px] font-bold tabular-nums text-on-dark shadow-sm shadow-primary-600/15">
            {metaEnd}
          </span>
        ) : null}
        {urgent ? (
          <EntityBadge
            label={DISPLAY_TEXT.urgent}
            tone="warning"
            className="px-2 py-0.5 text-[10px] tracking-[0.08em]"
          />
        ) : null}
      </div>
    </button>
  );
}

import { EntityBadge, EntityField } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass, mapTaskColorToEntityTone } from '@/components/shared/display/displayStatus';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { cn } from '@/lib/utils';
import { OpsQueueItem } from '@/src/server/dto/ops.dto';

interface OpsQueueCardProps extends OpsQueueItem {
  onClick?: (id: string) => void;
}

/** Top-1 order card displayed at the head of each queue. */
export function OpsQueueCard({
  id,
  customerName,
  nextActionAt,
  isUrgent,
  summary,
  derivedTask,
  onClick,
}: OpsQueueCardProps) {
  const timeInfo = nextActionAt ? classifyTime(nextActionAt) : null;
  const isClickable = typeof onClick === 'function';
  const actionLabel =
    derivedTask.primaryAction?.labelHe ?? derivedTask.primaryActionHe ?? 'ללא פעולה זמינה';
  const taskTone = mapTaskColorToEntityTone(derivedTask.taskColor);

  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      disabled={!isClickable}
      aria-disabled={!isClickable}
      className={cn(
        'w-full border-b border-white/40 px-4 py-3.5 text-start transition-colors last:border-0',
        isClickable ? 'hover:bg-white/60 cursor-pointer' : 'cursor-default'
      )}
    >
      {/* Top row: customer + urgency/time */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#0f172a]">
            {customerName ?? DISPLAY_TEXT.unknownCustomer}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-xs text-[#8fa2bf]">{summary}</span>
            <EntityBadge
              label={derivedTask.statusLabelHe}
              tone={taskTone}
              dotClassName={getEntityToneDotClass(taskTone)}
              className="px-1.5 py-0.5 tracking-[0.1em]"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isUrgent && (
            <EntityBadge label={DISPLAY_TEXT.urgent} tone="warning" className="px-1.5 tracking-tight" />
          )}
          {timeInfo && (
            <time
              className={cn(
                'tabular-nums text-[10px] font-medium',
                timeInfo.overdue ? 'text-red-500' : 'text-[#8fa2bf]'
              )}
              dateTime={nextActionAt!}
            >
              {timeInfo.label}
            </time>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {derivedTask.progressPct > 0 && (
        <div className="mb-2.5 h-1 w-full overflow-hidden rounded-full bg-[#e8f0f8]">
          <div
            className={cn('h-full rounded-full transition-all', getEntityToneDotClass(taskTone))}
            style={{ width: `${Math.min(100, derivedTask.progressPct)}%` }}
          />
        </div>
      )}

      {/* Bottom row: task title + action */}
      <div className="grid gap-2 sm:grid-cols-2">
        <EntityField label="משימה" value={derivedTask.taskTitleHe} tone="info" />
        <EntityField
          label={DISPLAY_TEXT.nextAction}
          value={actionLabel}
          tone={derivedTask.isActionableNow ? 'warning' : 'neutral'}
        />
      </div>
    </button>
  );
}

interface TimeInfo {
  label: string;
  overdue: boolean;
}

function classifyTime(iso: string): TimeInfo {
  const diff = new Date(iso).getTime() - Date.now();
  const overdue = diff < 0;
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60_000);
  let label: string;
  if (minutes < 60) label = `${minutes}m`;
  else if (minutes < 1440) label = `${Math.floor(minutes / 60)}h`;
  else label = `${Math.floor(minutes / 1440)}d`;
  return { label: overdue ? `-${label}` : label, overdue };
}

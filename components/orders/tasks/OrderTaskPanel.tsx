'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/use-toast';
import { useOrderTask } from '@/hooks/useOrderTask';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

const TASK_TYPE_LABELS: Record<string, string> = {
  CALL_BACK: 'חזרה ללקוח',
  INSTALL_REMINDER: 'תזכורת התקנה',
  STOCK_RECEIPT: 'קליטת מלאי',
  OTHER: 'משימה כללית',
};

const TASK_COLOR_STYLES: Record<string, string> = {
  RED: 'bg-[var(--color-danger-500)]',
  ORANGE: 'bg-[var(--color-warning-500)]',
  PURPLE: 'bg-[var(--color-primary-700)]',
  GREEN: 'bg-[var(--color-success-500)]',
  BLUE: 'bg-[var(--color-primary-500)]',
  GRAY: 'bg-[var(--color-neutral-400)]',
};

interface OrderTaskPanelProps {
  orderId: string;
  onChangeTaskType?: () => void;
  onTaskCompleted?: () => void;
  className?: string;
}

export function OrderTaskPanel({
  orderId,
  onChangeTaskType,
  onTaskCompleted,
  className,
}: OrderTaskPanelProps) {
  const { task, isLoading, isUpdating, updateChecklist, completeTask, refresh } =
    useOrderTask(orderId);
  const { toast } = useToast();
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  const checklist = task?.checklist ?? [];
  const requiredItems = checklist.filter((item: any) => item.required);
  const missingRequired = requiredItems.filter((item: any) => !item.checked);
  const isBlocked = missingRequired.length > 0;
  const doneCount = checklist.filter((item: any) => item.checked).length;
  const totalCount = checklist.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleComplete = async () => {
    const result = await completeTask({
      override: overrideMode ? { enabled: true, reason: overrideReason } : undefined,
    });

    if (result?.success) {
      toast({ title: 'שלב הושלם בהצלחה', variant: 'default' });
      setOverrideMode(false);
      setOverrideReason('');
      onTaskCompleted?.();
    } else if (result?.blocked) {
      toast({
        title: 'לא ניתן להשלים',
        description: `חסרים פריטים: ${result.missingItems?.join(', ')}`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'שגיאה',
        description: result?.error || 'אירעה שגיאה',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-[20px] border border-surface-strong bg-surface px-4 py-3 shadow-[0_18px_40px_-32px_rgba(34,22,16,0.35)]',
          className
        )}
        dir="rtl"
      >
        <Loader2 className="w-6 h-6 animate-spin text-fg-subtle" />
        <span className="mr-2 text-sm text-fg-muted">טוען משימה פעילה...</span>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const taskTypeLabel = TASK_TYPE_LABELS[task.type] ?? task.type;
  const colorStrip = TASK_COLOR_STYLES[task.color] ?? TASK_COLOR_STYLES.BLUE;

  return (
    <div
      dir="rtl"
      className={cn(
        'overflow-hidden rounded-[20px] border border-surface-strong bg-surface shadow-[0_18px_40px_-32px_rgba(34,22,16,0.35)]',
        className
      )}
    >
      <div className={cn('h-1 w-full', colorStrip)} />

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-[color-mix(in_srgb,var(--color-accent-500)_28%,transparent)] bg-[var(--tone-accent-bg)] text-[11px] font-medium text-accent"
              >
                {taskTypeLabel}
              </Badge>
              {task.dueAt && (
                <span className="flex items-center gap-1 text-xs text-fg-muted">
                  <Clock className="w-3 h-3" />
                  {new Date(task.dueAt).toLocaleDateString('he-IL')}
                </span>
              )}
              {totalCount > 0 && (
                <span className="rounded-full bg-surface-muted px-2 py-1 text-[10px] font-semibold text-fg-muted">
                  {doneCount}/{totalCount}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-tight text-fg">{task.title}</h3>
                {task.note ? (
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted text-truncate-2">
                    {task.note}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={refresh}
                  className="rounded-xl p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted"
                  title="רענן"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                {onChangeTaskType && (
                  <button
                    onClick={onChangeTaskType}
                    className="rounded-xl p-1.5 text-fg-subtle transition-colors hover:bg-surface-muted"
                    title="שנה סוג משימה"
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </button>
                )}
                <Button
                  onClick={handleComplete}
                  disabled={
                    isUpdating ||
                    (isBlocked && !overrideMode) ||
                    (overrideMode && !overrideReason.trim())
                  }
                  size="sm"
                  className={cn(
                    'h-9 gap-1.5 rounded-full px-3 text-[12px]',
                    overrideMode
                      ? 'bg-[var(--color-warning-600)] text-on-inverse hover:bg-[var(--color-warning-700)]'
                      : 'bg-accent text-on-inverse hover:bg-accent-deep'
                  )}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {overrideMode ? 'אישור חריגה' : 'סיום שלב'}
                </Button>
              </div>
            </div>

            {isBlocked && !overrideMode ? (
              <div className="mt-2 flex items-start gap-2 rounded-[14px] border border-[color-mix(in_srgb,var(--color-danger-500)_22%,transparent)] bg-[var(--color-danger-50)] px-3 py-2 text-[11px] text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold">חסר לסיום:</span>{' '}
                  <span>{missingRequired.map((i: any) => i.label).join(', ')}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {totalCount > 0 && (
          <div className="mt-3 overflow-hidden rounded-[18px] border border-subtle">
            <button
              className="flex w-full items-center justify-between bg-surface-muted px-3 py-2.5 transition-colors hover:bg-[var(--color-neutral-100)]"
              onClick={() => setChecklistExpanded((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-fg">
                  צ&apos;קליסט ({doneCount}/{totalCount})
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-progress-track">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      pct >= 100 ? 'bg-[var(--color-success-600)]' : 'bg-accent'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-fg-subtle">{pct}%</span>
              </div>
              {checklistExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-fg-subtle" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" />
              )}
            </button>

            {checklistExpanded && (
              <div className="divide-y divide-[var(--color-neutral-200)]">
                {checklist.map((item: any) => (
                  <label
                    key={item.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors',
                      item.checked ? 'bg-[var(--color-success-50)]' : 'bg-surface hover:bg-[var(--tone-accent-bg)]',
                      item.kind === 'data' && 'cursor-default'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(item.checked)}
                      disabled={item.kind === 'data' || isUpdating}
                      onChange={(e) =>
                        updateChecklist([{ itemId: item.id, checked: e.target.checked }])
                      }
                      className="h-4 w-4 shrink-0 rounded border-subtle text-success focus:ring-2 focus:ring-[var(--color-success-500)]"
                    />
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-[13px] select-none',
                          item.checked ? 'line-through text-fg-subtle' : 'text-fg'
                        )}
                      >
                        {item.label}
                        {item.required && <span className="mr-1 text-danger not-italic">*</span>}
                      </span>
                    </div>
                    {item.kind === 'data' && (
                      <span className="shrink-0 rounded bg-info-soft px-1.5 py-0.5 text-[10px] text-brand">
                        אוטומטי
                      </span>
                    )}
                    {item.checked && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {overrideMode && (
          <div className="mt-3 space-y-2 rounded-[16px] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] p-3">
            <p className="flex items-center gap-1 text-xs font-bold text-warning">
              <Lock className="h-3 w-3" />
              מעקף שלב – הזן סיבה:
            </p>
            <textarea
              className="w-full resize-none rounded-md border border-[var(--color-warning-200)] bg-surface p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warning-300)]"
              rows={2}
              placeholder="למה מדלגים על השלב?"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
            <button
              onClick={() => {
                setOverrideMode(false);
                setOverrideReason('');
              }}
              className="text-[11px] text-warning hover:underline"
            >
              ביטול מעקף
            </button>
          </div>
        )}

        {isBlocked && !overrideMode ? (
          <div className="mt-3 flex items-center justify-end">
            <button
              onClick={() => setOverrideMode(true)}
              className="flex items-center gap-1 text-xs text-fg-subtle transition-colors hover:text-fg-muted"
            >
              <Lock className="h-3 w-3" />
              המשך בכל זאת
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

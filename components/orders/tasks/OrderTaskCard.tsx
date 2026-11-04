'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  List,
  Phone,
  RefreshCw,
  User,
} from 'lucide-react';
import Link from 'next/link';

export type OrderTaskType = 'CALL_BACK' | 'INSTALL_REMINDER' | 'STOCK_RECEIPT' | 'OTHER';

export interface OrderTask {
  id: string;
  type: OrderTaskType | string;
  status: TaskStatus;
  priority: TaskPriority;
  notes: string | null;
  dueAt: string | null;
  aiTitleHe: string | null;
  aiSummaryHe: string | null;
  checklistTotal?: number;
  checklistDone?: number;
  order: {
    id: string;
    number: string;
    customerName: string | null;
    customerPhone: string | null;
    status: string;
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string;
  } | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

const TASK_TYPE_CONFIG: Record<
  string,
  {
    labelHe: string;
    color: string;
    bgColor: string;
    borderColor: string;
    accentStrip: string;
  }
> = {
  CALL_BACK: {
    labelHe: 'חזרה ללקוח',
    color: 'text-brand-deep',
    bgColor: 'bg-primary-50',
    borderColor: 'border-primary-200',
    accentStrip: 'bg-primary-600',
  },
  INSTALL_REMINDER: {
    labelHe: 'תזכורת התקנה',
    color: 'text-[var(--color-primary-800)]',
    bgColor: 'bg-primary-50',
    borderColor: 'border-primary-300',
    accentStrip: 'bg-[var(--color-primary-800)]',
  },
  STOCK_RECEIPT: {
    labelHe: 'קליטת מלאי',
    color: 'text-[var(--color-success-700)]',
    bgColor: 'bg-[var(--color-success-50)]',
    borderColor: 'border-[var(--color-success-200)]',
    accentStrip: 'bg-[var(--color-success-600)]',
  },
  OTHER: {
    labelHe: 'משימה כללית',
    color: 'text-fg-muted',
    bgColor: 'bg-surface-muted',
    borderColor: 'border-subtle',
    accentStrip: 'bg-[var(--color-neutral-400)]',
  },
};

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { labelHe: string; color: string; bgColor: string }
> = {
  LOW: { labelHe: 'נמוכה', color: 'text-fg-muted', bgColor: 'bg-surface-highlight' },
  MEDIUM: { labelHe: 'רגילה', color: 'text-brand', bgColor: 'bg-primary-50' },
  HIGH: { labelHe: 'גבוהה', color: 'text-warning', bgColor: 'bg-[var(--color-warning-50)]' },
  URGENT: { labelHe: 'דחוף', color: 'text-danger', bgColor: 'bg-[var(--color-danger-50)]' },
};

function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt) < new Date();
}

function formatDueDate(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return overdueDays === 1 ? 'אמש' : `לפני ${overdueDays} ימים`;
  }
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'מחר';
  if (diffDays <= 7) return `בעוד ${diffDays} ימים`;
  return date.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' });
}

interface OrderTaskCardProps {
  task: OrderTask;
  onComplete?: (taskId: string) => void;
  onChangeType?: (taskId: string) => void;
  onViewChecklist?: (taskId: string) => void;
  className?: string;
  compact?: boolean;
}

export function OrderTaskCard({
  task,
  onComplete,
  onChangeType,
  onViewChecklist,
  className,
  compact = false,
}: OrderTaskCardProps) {
  const typeConfig = TASK_TYPE_CONFIG[task.type] ?? TASK_TYPE_CONFIG.OTHER;
  const priorityConfig = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM;
  const overdue = isOverdue(task.dueAt);
  const isDone = task.status === TaskStatus.DONE;
  const dueDateLabel = formatDueDate(task.dueAt);
  const hasChecklist = (task.checklistTotal ?? 0) > 0;
  const checklistPct =
    hasChecklist ? Math.round(((task.checklistDone ?? 0) / (task.checklistTotal ?? 1)) * 100) : 0;

  return (
    <div
      dir="rtl"
      className={cn(
        'group relative rounded-xl border bg-surface transition-all',
        overdue && !isDone
          ? 'border-[var(--color-danger-200)] shadow-sm shadow-[color-mix(in_srgb,var(--color-danger-500)_08%,transparent)]'
          : 'border-subtle',
        isDone ? 'opacity-60' : 'hover:shadow-md',
        className
      )}
    >
      {/* Left color strip */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 w-1 rounded-r-xl',
          isDone
            ? 'bg-[var(--color-success-500)]'
            : overdue
              ? 'bg-[var(--color-danger-500)]'
              : typeConfig.accentStrip
        )}
      />

      <div className={cn('p-4 pr-5', compact && 'p-3 pr-4')}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Task type badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border',
                typeConfig.color,
                typeConfig.bgColor,
                typeConfig.borderColor
              )}
            >
              {typeConfig.labelHe}
            </span>

            {/* Priority badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
                priorityConfig.color,
                priorityConfig.bgColor
              )}
            >
              {priorityConfig.labelHe}
            </span>

            {/* Overdue badge */}
            {overdue && !isDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-[var(--color-danger-700)] bg-[var(--color-danger-50)] border border-[var(--color-danger-200)]">
                <AlertCircle className="w-3 h-3" />
                באיחור
              </span>
            )}

            {/* Done badge */}
            {isDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-[var(--color-success-700)] bg-[var(--color-success-50)] border border-[var(--color-success-200)]">
                <CheckCircle2 className="w-3 h-3" />
                הושלם
              </span>
            )}
          </div>

          {/* Due date */}
          {dueDateLabel && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs whitespace-nowrap shrink-0',
                overdue && !isDone ? 'text-danger font-medium' : 'text-fg-muted'
              )}
            >
              <Clock className="w-3 h-3" />
              {dueDateLabel}
            </span>
          )}
        </div>

        {/* Task title */}
        <h3
          className={cn(
            'font-bold text-fg leading-snug mb-1',
            compact ? 'text-sm' : 'text-base',
            isDone && 'line-through text-fg-muted'
          )}
        >
          {task.aiTitleHe || 'משימה מתעדכנת...'}
        </h3>

        {/* Summary / notes */}
        {!compact && (task.aiSummaryHe || task.notes) && (
          <p className="text-xs text-fg-muted mb-3 leading-relaxed line-clamp-2">
            {task.aiSummaryHe || task.notes}
          </p>
        )}

        {/* Checklist progress */}
        {hasChecklist && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 bg-surface-highlight rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  checklistPct >= 100
                    ? 'bg-[var(--color-success-500)]'
                    : 'bg-[var(--color-success-600)]'
                )}
                style={{ width: `${checklistPct}%` }}
              />
            </div>
            <span className="text-[11px] text-fg-muted whitespace-nowrap">
              {task.checklistDone}/{task.checklistTotal}
            </span>
          </div>
        )}

        {/* Meta row: order, assignee */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            {/* Order link */}
            {task.order && (
              <Link
                href={`/orders/${task.order.id}`}
                className="flex items-center gap-1 text-xs text-fg-muted hover:text-brand transition-colors group/link"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="font-mono font-medium">#{task.order.number}</span>
                {task.order.customerName && (
                  <span className="text-fg-muted">{task.order.customerName}</span>
                )}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </Link>
            )}

            {/* Deal link */}
            {task.deal && !task.order && (
              <Link
                href={`/deals/${task.deal.id}`}
                className="flex items-center gap-1 text-xs text-fg-muted hover:text-brand-deep transition-colors group/link"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="font-medium">{task.deal.name}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </Link>
            )}

            {/* Assignee */}
            {task.assignee && (
              <span className="flex items-center gap-1 text-xs text-fg-muted">
                <User className="w-3 h-3" />
                {task.assignee.name || task.assignee.email}
              </span>
            )}

            {/* Customer phone */}
            {task.order?.customerPhone && !compact && (
              <a
                href={`tel:${task.order.customerPhone}`}
                className="flex items-center gap-1 text-xs text-fg-muted hover:text-success transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-3 h-3" />
                {task.order.customerPhone}
              </a>
            )}
          </div>

          {/* Action buttons */}
          {!isDone && (
            <div className="flex items-center gap-1 shrink-0">
              {hasChecklist && onViewChecklist && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-fg-muted hover:text-fg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewChecklist(task.id);
                  }}
                >
                  <List className="w-3.5 h-3.5 ml-1" />
                  צ&apos;קליסט
                </Button>
              )}

              {onChangeType && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-fg-muted hover:text-fg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeType(task.id);
                  }}
                  title="שנה סוג משימה"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}

              {onComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs border-[var(--color-success-200)] text-[var(--color-success-700)] hover:bg-[var(--color-success-50)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete(task.id);
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                  סיום
                </Button>
              )}
            </div>
          )}

          {isDone && task.order && (
            <Link
              href={`/orders/${task.order.id}`}
              className="flex items-center gap-1 text-xs text-fg-subtle hover:text-fg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

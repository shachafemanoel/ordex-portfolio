'use client';

import { OrderTask, OrderTaskCard, OrderTaskType } from '@/components/orders/tasks/OrderTaskCard';
import { cn } from '@/lib/utils';
import { CheckCircle, MoreHorizontal, Plus } from 'lucide-react';

interface OrderTaskListProps {
  title?: string;
  tasks: OrderTask[];
  loading?: boolean;
  taskCount?: number;
  showAddButton?: boolean;
  onAddTask?: () => void;
  onTaskComplete?: (taskId: string) => void;
  onTaskChangeType?: (taskId: string) => void;
  onViewChecklist?: (taskId: string) => void;
  compact?: boolean;
  className?: string;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-subtle bg-surface p-4 animate-pulse" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-20 bg-surface-highlight rounded-md" />
        <div className="h-5 w-14 bg-surface-highlight rounded-md" />
      </div>
      <div className="h-5 w-3/4 bg-surface-highlight rounded mb-2" />
      <div className="h-3 w-full bg-surface-muted rounded mb-1" />
      <div className="h-3 w-2/3 bg-surface-muted rounded" />
    </div>
  );
}

export function OrderTaskList({
  title = 'משימות',
  tasks,
  loading = false,
  taskCount,
  showAddButton = true,
  onAddTask,
  onTaskComplete,
  onTaskChangeType,
  onViewChecklist,
  compact = false,
  className,
}: OrderTaskListProps) {
  const displayCount = taskCount ?? tasks.length;

  return (
    <div
      className={cn(
        'bg-surface rounded-2xl border border-subtle shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-subtle-light">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-fg" dir="rtl">
            {title}
          </h2>
          {displayCount > 0 && (
            <span className="bg-surface-highlight text-fg-muted text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {displayCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
            aria-label="אפשרויות נוספות"
          >
            <MoreHorizontal className="w-4 h-4 text-fg-muted" />
          </button>
          {showAddButton && onAddTask && (
            <button
              onClick={onAddTask}
              className="p-2 hover:bg-primary-50 text-brand rounded-lg transition-colors"
              aria-label="הוסף משימה"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Task items */}
      <div className="p-4 space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12" dir="rtl">
            <div className="inline-block p-4 bg-[var(--color-success-50)] rounded-full mb-3">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <p className="text-fg-muted font-medium">אין משימות פתוחות</p>
            <p className="text-sm text-fg-subtle mt-1">כל המשימות הושלמו בהצלחה!</p>
            {showAddButton && onAddTask && (
              <button
                onClick={onAddTask}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-deep font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                הוסף משימה חדשה
              </button>
            )}
          </div>
        ) : (
          tasks.map((task) => (
            <OrderTaskCard
              key={task.id}
              task={task}
              onComplete={onTaskComplete}
              onChangeType={onTaskChangeType}
              onViewChecklist={onViewChecklist}
              compact={compact}
            />
          ))
        )}
      </div>

      {/* Footer add button */}
      {showAddButton && onAddTask && tasks.length > 0 && (
        <div className="px-4 pb-4 border-t border-subtle-light pt-3">
          <button
            onClick={onAddTask}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-fg-muted hover:text-fg hover:bg-surface-muted rounded-lg transition-colors text-sm font-medium"
            dir="rtl"
          >
            <Plus className="w-4 h-4" />
            הוסף משימה
          </button>
        </div>
      )}
    </div>
  );
}

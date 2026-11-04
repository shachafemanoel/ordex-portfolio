'use client';

import { OpsFlowNote, OpsFlowPrimaryButton } from '@/components/orders/ops/OpsFlowPrimitives';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useSmartDrill } from '@/hooks/useSmartDrill';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// Actions whose result triggers a status transition we want to surface upstream
const ACTION_STATUS_MAP: Record<string, string> = {
  'mark-supplied': 'SUPPLIED',
  'mark-ready-delivery': 'IN_TRANSIT',
  'mark-customer-contacted': 'PROCESSING',
};

interface DrillChecklistProps {
  orderId: string;
  className?: string;
  /** Optional: called after an action successfully changes the order status */
  onStatusChange?: (newStatus: string) => void;
}

export function DrillChecklist({ orderId, className, onStatusChange }: DrillChecklistProps) {
  const { drillState, updateChecklist, performAction, isLoading } = useSmartDrill(orderId);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-fg-subtle">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!drillState) {
    return <div className="p-4 text-center text-sm text-danger">נכשל בטעינת נתונים</div>;
  }

  const rootState = (drillState as any)?.data ?? drillState;
  const lifecycle = Array.isArray(rootState?.lifecycle) ? rootState.lifecycle : [];
  const currentTaskRaw = rootState?.currentTask;
  const currentTask = {
    taskLabel: currentTaskRaw?.taskLabel ?? '',
    steps: Array.isArray(currentTaskRaw?.steps) ? currentTaskRaw.steps : [],
    quickActions: Array.isArray(currentTaskRaw?.quickActions) ? currentTaskRaw.quickActions : [],
  };

  if (lifecycle.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-fg-muted">
        לא נמצאו שלבי עבודה להצגה עבור ההזמנה.
      </div>
    );
  }

  const handleAction = async (actionId: string, kind: string) => {
    // Modal-kind actions need a form — guide user to full order view
    if (kind === 'modal') {
      toast.info('פתח את דף ההזמנה לביצוע פעולה זו');
      return;
    }

    setLoadingAction(actionId);
    try {
      await performAction(actionId);
      toast.success('הפעולה בוצעה בהצלחה');

      // Notify parent of status change if applicable
      const newStatus = ACTION_STATUS_MAP[actionId];
      if (newStatus && onStatusChange) {
        onStatusChange(newStatus);
      }
    } catch (error) {
      toast.error('שגיאה בביצוע הפעולה');
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const isChecklistComplete = currentTask.steps.every(
    (step: any) => !step.required || step.status === 'DONE'
  );

  return (
    <div className={cn('space-y-2 font-sans', className)} dir="rtl">
      {lifecycle.map((stage: any, idx: number) => {
        const isCurrent = stage.status === 'CURRENT';
        const isDone = stage.status === 'DONE';

        return (
          <div
            key={stage.label + idx}
            className={cn(
              'overflow-hidden rounded-[24px] border bg-surface transition-all duration-300',
              isCurrent
                ? 'border-[var(--color-primary-200)] shadow-[0_18px_44px_-24px_rgba(15,23,42,0.12)] ring-1 ring-[var(--color-primary-100)]'
                : 'border-[color-mix(in_srgb,var(--color-primary-200)_45%,var(--color-border-primary))] opacity-90 hover:opacity-100'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between px-4 py-3',
                isCurrent ? 'bg-[var(--color-primary-100)]' : 'bg-[var(--color-primary-50)]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold shadow-sm',
                    isDone
                      ? 'border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
                      : isCurrent
                        ? 'border-primary-500 bg-primary-500 text-on-dark'
                        : 'border-[var(--color-primary-200)] bg-surface text-ops-icon-muted'
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : <span>{idx + 1}</span>}
                </div>
                <span
                  className={cn(
                    'text-sm font-bold tracking-tight',
                    isDone && 'text-fg-muted line-through decoration-[color-mix(in_srgb,var(--color-neutral-300)_50%,transparent)]',
                    isCurrent ? 'text-brand' : 'text-fg-muted'
                  )}
                >
                  {stage.labelHe}
                </span>
              </div>
            </div>

            {isCurrent && (
              <div className="animate-in slide-in-from-top-2 space-y-5 border-t border-[var(--color-primary-200)] bg-surface p-4 duration-300">
                {currentTask.steps.length > 0 ? (
                  <div className="space-y-3">
                    {currentTask.steps.map((step: any) => (
                      <div
                        key={step.id}
                        className={cn(
                          'flex items-start gap-3 rounded-[20px] border px-4 py-3',
                          step.status === 'DONE'
                            ? 'border-[var(--color-success-200)] bg-[var(--color-success-50)]'
                            : 'border-[color-mix(in_srgb,var(--color-primary-200)_45%,var(--color-border-primary))] bg-[var(--color-primary-50)]'
                        )}
                      >
                        <Checkbox
                          id={step.id}
                          checked={step.status === 'DONE'}
                          onCheckedChange={(checked) =>
                            updateChecklist(currentTask.taskLabel, step.id, checked as boolean)
                          }
                          disabled={step.status === 'BLOCKED'}
                          className="mt-0.5 border-subtle data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500"
                        />
                        <div className="grid gap-1 leading-none flex-1">
                          <label
                            htmlFor={step.id}
                            className={cn(
                              'cursor-pointer select-none text-sm font-medium leading-normal transition-colors',
                              step.status === 'DONE'
                                ? 'text-fg-subtle line-through decoration-[var(--color-neutral-300)]'
                                : 'text-fg'
                            )}
                          >
                            {step.labelHe}
                          </label>
                          {step.actionHint ? (
                            <p className="text-xs font-medium text-fg-muted">{step.actionHint}</p>
                          ) : null}
                          {step.missingFields && step.missingFields.length > 0 ? (
                            <p className="mt-1 flex w-fit items-center gap-1 rounded bg-[var(--color-danger-50)] p-1 text-xs font-medium text-danger">
                              <AlertCircle className="h-3 w-3" />
                              חסר: {step.missingFields.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <OpsFlowNote className="text-center">אין משימות לשלב זה</OpsFlowNote>
                )}

                {currentTask.quickActions.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {currentTask.quickActions.map((action: any) => {
                      const isModal = action.kind === 'modal';
                      const isDisabled =
                        (!isChecklistComplete && !isModal) || loadingAction === action.id;
                      return isModal ? (
                        <Button
                          key={action.id}
                          size="sm"
                          disabled={isDisabled}
                          onClick={() => handleAction(action.id, action.kind)}
                          variant="outline"
                          className="flex-1 rounded-full border-[var(--color-primary-200)] text-brand-deep hover:bg-[var(--color-primary-50)] md:flex-none"
                        >
                          {loadingAction === action.id ? (
                            <Loader2 className="ml-2 h-3 w-3 animate-spin" />
                          ) : null}
                          {action.labelHe}
                        </Button>
                      ) : (
                        <div key={action.id} className="flex-1 md:flex-none">
                          <OpsFlowPrimaryButton
                            accent="primary"
                            icon={loadingAction === action.id ? Loader2 : Check}
                            disabled={isDisabled}
                            loading={loadingAction === action.id}
                            onClick={() => handleAction(action.id, action.kind)}
                          >
                            {action.labelHe}
                          </OpsFlowPrimaryButton>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

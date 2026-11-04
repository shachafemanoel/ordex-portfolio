import { cn } from '@/lib/utils';
import { ORDER_STATUS_CONFIG, ORDER_STATUS_FLOW } from '@/lib/orderStatus';
import type { OrderStatus } from '@prisma/client';

/**
 * Maps each canonical status to its step number in the order flow.
 * RECEIVED=1, PROCESSING=2, READY=3, IN_TRANSIT=4, INSTALLATION=5, COMPLETED=6
 */
const CANONICAL_STEP: Partial<Record<OrderStatus, number>> = Object.fromEntries(
  ORDER_STATUS_FLOW.map((s, i) => [s, i + 1])
);

const TOTAL_STEPS = ORDER_STATUS_FLOW.filter(
  (s) => s !== 'CANCELLED'
).length;

const STEP_THEME: Record<string, { bg: string; text: string; accent: string; bar: string }> = {
  RECEIVED:     { bg: 'bg-slate-50',   text: 'text-slate-700',   accent: 'text-slate-500',   bar: 'bg-slate-400' },
  PROCESSING:   { bg: 'bg-blue-50',    text: 'text-blue-800',    accent: 'text-blue-500',    bar: 'bg-blue-500' },
  READY:        { bg: 'bg-green-50',   text: 'text-green-800',   accent: 'text-green-500',   bar: 'bg-green-500' },
  IN_TRANSIT:   { bg: 'bg-sky-50',     text: 'text-sky-800',     accent: 'text-sky-500',     bar: 'bg-sky-500' },
  INSTALLATION: { bg: 'bg-violet-50',  text: 'text-violet-800',  accent: 'text-violet-500',  bar: 'bg-violet-500' },
  COMPLETED:    { bg: 'bg-emerald-50', text: 'text-emerald-800', accent: 'text-emerald-500', bar: 'bg-emerald-500' },
  CANCELLED:    { bg: 'bg-red-50',     text: 'text-red-800',     accent: 'text-red-500',     bar: 'bg-red-500' },
  ON_HOLD:      { bg: 'bg-amber-50',   text: 'text-amber-800',   accent: 'text-amber-500',   bar: 'bg-amber-400' },
};

function getTheme(status: OrderStatus) {
  return (
    STEP_THEME[status] ?? {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      accent: 'text-slate-500',
      bar: 'bg-slate-400',
    }
  );
}

interface OrderModalStepHeaderProps {
  /** Current order status (determines step number and color) */
  currentStatus: OrderStatus;
  /** Target status for transitions (optional) */
  targetStatus?: OrderStatus;
  /** Override label for the step (defaults to current status Hebrew label) */
  stepLabel?: string;
  /** Short description shown below the step label */
  description?: string;
  className?: string;
}

/**
 * Step-context header for order modals.
 *
 * Shows the current position in the order lifecycle with a progress bar,
 * step counter, and transition arrow when a target status is provided.
 *
 * Usage:
 * ```tsx
 * <OrderModalStepHeader currentStatus="PROCESSING" targetStatus="READY" />
 * ```
 */
export function OrderModalStepHeader({
  currentStatus,
  targetStatus,
  stepLabel,
  description,
  className,
}: OrderModalStepHeaderProps) {
  const step = CANONICAL_STEP[currentStatus];
  const targetStep = targetStatus ? CANONICAL_STEP[targetStatus] : undefined;
  const theme = getTheme(targetStatus ?? currentStatus);
  const currentLabel = ORDER_STATUS_CONFIG[currentStatus]?.label ?? currentStatus;
  const targetLabel = targetStatus
    ? (ORDER_STATUS_CONFIG[targetStatus]?.label ?? targetStatus)
    : undefined;

  const displayStep = targetStep ?? step;
  const progressPct =
    displayStep && TOTAL_STEPS > 0
      ? Math.round((displayStep / TOTAL_STEPS) * 100)
      : 0;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 mb-4',
        theme.bg,
        'border-opacity-60',
        className
      )}
      dir="rtl"
    >
      {/* Step label row */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Current status chip */}
          <span className={cn('text-xs font-semibold', theme.accent)}>
            {step ? `שלב ${step}` : ''}
          </span>
          <span className={cn('text-sm font-bold', theme.text)}>
            {currentLabel}
          </span>

          {/* Arrow + target */}
          {targetLabel && (
            <>
              <span className={cn('text-sm', theme.accent)}>←</span>
              <span className={cn('text-sm font-bold', theme.text)}>{targetLabel}</span>
              {targetStep && (
                <span className={cn('text-xs font-semibold', theme.accent)}>
                  (שלב {targetStep})
                </span>
              )}
            </>
          )}
        </div>

        {/* Step counter */}
        {displayStep && (
          <span className={cn('text-xs whitespace-nowrap font-medium', theme.accent)}>
            {displayStep} / {TOTAL_STEPS}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', theme.bar)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Optional description */}
      {description && (
        <p className={cn('mt-2 text-xs leading-relaxed', theme.accent)}>{description}</p>
      )}

      {/* Custom step label override */}
      {stepLabel && !description && (
        <p className={cn('mt-1.5 text-xs font-medium', theme.accent)}>{stepLabel}</p>
      )}
    </div>
  );
}

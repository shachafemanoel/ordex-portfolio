import type { DerivedTaskInfo } from '@/src/server/dto/ops.dto';

/** Collapsed cards: weekday only (no time) */
export function formatNextActionWeekdayShort(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
  }).format(date);
}

/** Time only (for compact shipment chips) */
export function formatNextActionTimeOnly(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Expanded / detail: weekday + date + time */
export function formatNextActionDetailed(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** @deprecated use formatNextActionWeekdayShort (collapsed) or formatNextActionDetailed (expanded) */
export function formatNextActionAt(value: string | null): string | null {
  return formatNextActionDetailed(value);
}

export function getOrderCardAppearance(derivedTask: DerivedTaskInfo, isUrgent: boolean) {
  const isActionableNow = derivedTask.isActionableNow;
  const isPriorityOrder = isUrgent || derivedTask.taskColor === 'ORANGE';

  return {
    isActionableNow,
    isPriorityOrder,
    statusToneClass:
      derivedTask.taskColor === 'ORANGE'
        ? 'border-[color-mix(in_srgb,var(--color-warning-500)_28%,transparent)] bg-[var(--color-warning-50)] text-[var(--color-warning-700)]'
        : derivedTask.taskColor === 'BLUE'
          ? 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-brand'
          : 'border-subtle bg-surface-muted text-fg-muted',
    surfaceClass: isPriorityOrder
      ? 'border-[color:color-mix(in_srgb,var(--color-warning-500)_24%,var(--color-border-primary))] bg-[var(--color-warning-50)]'
      : 'border-[color:var(--color-border-primary)] bg-surface',
  };
}

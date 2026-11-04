'use client';

import { cn } from '@/lib/utils';

export type OpsTrafficSignal = 'red' | 'yellow' | 'green';
export type OpsTaskColor = 'BLUE' | 'ORANGE' | 'GRAY' | 'RED' | 'PURPLE' | 'GREEN';

type TrafficCopy = {
  signal: OpsTrafficSignal;
  labelHe: string;
  hintHe: string;
};

const SIGNAL_STYLES: Record<
  OpsTrafficSignal,
  { active: string; muted: string; text: string; ring: string }
> = {
  red: {
    active: 'bg-rose-500',
    muted: 'bg-rose-100',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
  },
  yellow: {
    active: 'bg-amber-500',
    muted: 'bg-amber-100',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
  },
  green: {
    active: 'bg-emerald-500',
    muted: 'bg-emerald-100',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
};

export function getOrderTrafficCopy(taskColor: OpsTaskColor, urgent?: boolean): TrafficCopy {
  if (urgent || taskColor === 'BLUE' || taskColor === 'RED') {
    return {
      signal: 'red',
      labelHe: 'אדום',
      hintHe: urgent ? 'דחוף לטיפול מיידי' : 'דורש פעולה עכשיו',
    };
  }

  if (taskColor === 'ORANGE') {
    return {
      signal: 'yellow',
      labelHe: 'צהוב',
      hintHe: 'בתהליך הכנה ורכש',
    };
  }

  return {
    signal: 'green',
    labelHe: 'ירוק',
    hintHe: 'בהמתנה מבוקרת',
  };
}

export function OpsTrafficLight({
  signal,
  labelHe,
  hintHe,
  compact = false,
  className,
}: {
  signal: OpsTrafficSignal;
  labelHe: string;
  hintHe: string;
  compact?: boolean;
  className?: string;
}) {
  const style = SIGNAL_STYLES[signal];
  const order: OpsTrafficSignal[] = ['red', 'yellow', 'green'];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border bg-white/85 px-2 py-1 backdrop-blur-sm',
        style.ring,
        className
      )}
    >
      <div className="flex items-center gap-1">
        {order.map((dot) => {
          const isActive = dot === signal;
          return (
            <span
              key={dot}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all duration-300',
                isActive
                  ? cn(SIGNAL_STYLES[dot].active, dot !== 'green' && 'animate-pulse')
                  : SIGNAL_STYLES[dot].muted
              )}
            />
          );
        })}
      </div>
      <div className={cn('leading-none', style.text)}>
        <span className={cn('font-bold', compact ? 'text-[10px]' : 'text-xs')}>{labelHe}</span>
        {!compact && <span className="ms-1 text-[10px] text-gray-500">{hintHe}</span>}
      </div>
    </div>
  );
}

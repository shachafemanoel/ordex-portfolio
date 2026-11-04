'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

const WINDOW_HOURS = 3;
const DISPLAY_HOUR_START = 7;
const DISPLAY_HOUR_END = 22;
/** גובה שורה לכל חלון של 3 שעות */
const PX_PER_WINDOW = 112;

const SLOT_RANGE_MINUTES: Record<string, { start: number; end: number }> = {
  MORNING: { start: 8 * 60, end: 12 * 60 },
  AFTERNOON: { start: 12 * 60, end: 16 * 60 },
  EVENING: { start: 16 * 60, end: 20 * 60 },
  CUSTOM: { start: 9 * 60, end: 13 * 60 },
};

const ORDER_STATUS_DELIVERY = new Set<string>(['IN_TRANSIT', 'READY']);
const ORDER_STATUS_INSTALL = new Set<string>([
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'INSTALLATION',
  'INSTALLED',
]);

function calendarJobKind(orderStatus: string | null | undefined): 'install' | 'delivery' {
  const s = String(orderStatus || '').toUpperCase();
  if (ORDER_STATUS_DELIVERY.has(s)) return 'delivery';
  if (ORDER_STATUS_INSTALL.has(s)) return 'install';
  return 'install';
}

export interface WorkCalendarTwoDayTask {
  id: string;
  scheduledDate: string;
  timeSlot?: string | null;
  durationMinutes?: number | null;
  status: string;
  order: {
    id: string;
    customerName: string | null;
    city?: string | null;
    status?: string | null;
    scheduledAt?: string | null;
  };
  technician?: { name: string } | null;
}

function dateKeyFromIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysToKey(key: string, delta: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return dateKeyFromIso(d);
}

function isSameDayKey(key: string): boolean {
  return key === dateKeyFromIso(new Date());
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function hebrewWeekdayShort(d: Date): string {
  return d.toLocaleDateString('he-IL', { weekday: 'short' });
}

function hebrewMonthYear(d: Date): string {
  return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function hebrewCalendarDayHint(d: Date): string | null {
  try {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(d);
  } catch {
    try {
      return d.toLocaleDateString('he-IL', { day: 'numeric', calendar: 'hebrew' as Intl.DateTimeFormatOptions['calendar'] });
    } catch {
      return null;
    }
  }
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function getTaskMinuteRange(task: WorkCalendarTwoDayTask): { start: number; end: number } {
  const scheduled = task.order.scheduledAt ? new Date(task.order.scheduledAt) : null;
  if (scheduled && !Number.isNaN(scheduled.getTime())) {
    const start = minutesFromMidnight(scheduled);
    const dur = Math.max(task.durationMinutes ?? 60, 30);
    return { start, end: start + dur };
  }
  const slot = task.timeSlot && SLOT_RANGE_MINUTES[task.timeSlot] ? task.timeSlot : 'MORNING';
  const range = SLOT_RANGE_MINUTES[slot] ?? SLOT_RANGE_MINUTES.MORNING;
  return { start: range.start, end: range.end };
}

/** חלונות 3 שעות מ־DISPLAY_HOUR_START עד DISPLAY_HOUR_END */
function getTimeWindows(): Array<{ startMin: number; endMin: number; label: string }> {
  const out: Array<{ startMin: number; endMin: number; label: string }> = [];
  for (let h = DISPLAY_HOUR_START; h + WINDOW_HOURS <= DISPLAY_HOUR_END; h += WINDOW_HOURS) {
    out.push({
      startMin: h * 60,
      endMin: (h + WINDOW_HOURS) * 60,
      label: `${formatHourLabel(h)}–${formatHourLabel(h + WINDOW_HOURS)}`,
    });
  }
  return out;
}

function taskWindowIndex(
  task: WorkCalendarTwoDayTask,
  windowCount: number
): number {
  const { start } = getTaskMinuteRange(task);
  const winStartMin = DISPLAY_HOUR_START * 60;
  const spanMin = WINDOW_HOURS * 60;
  let idx = Math.floor((Math.max(start, winStartMin) - winStartMin) / spanMin);
  if (!Number.isFinite(idx) || idx < 0) idx = 0;
  if (idx >= windowCount) idx = windowCount - 1;
  return idx;
}

function groupTasksByWindows(
  dayTasks: WorkCalendarTwoDayTask[],
  windowCount: number
): WorkCalendarTwoDayTask[][] {
  const buckets: WorkCalendarTwoDayTask[][] = Array.from({ length: windowCount }, () => []);
  for (const task of dayTasks) {
    buckets[taskWindowIndex(task, windowCount)].push(task);
  }
  for (const b of buckets) {
    b.sort((a, c) => getTaskMinuteRange(a).start - getTaskMinuteRange(c).start);
  }
  return buckets;
}

const TASK_SHELL_CLASS: Record<string, string> = {
  COMPLETED: 'bg-slate-50/90',
  CANCELLED: 'bg-slate-100 opacity-75',
  DEFAULT: 'bg-white',
};

export interface WorkCalendarTwoDayGridProps {
  anchorDate: string;
  onAnchorChange: (next: string) => void;
  onToday: () => void;
  tasks: WorkCalendarTwoDayTask[];
  onCompleteTask: (taskId: string) => void;
  completePending?: boolean;
  className?: string;
}

export function WorkCalendarTwoDayGrid({
  anchorDate,
  onAnchorChange,
  onToday,
  tasks,
  onCompleteTask,
  completePending,
  className,
}: Readonly<WorkCalendarTwoDayGridProps>) {
  const timeWindows = useMemo(() => getTimeWindows(), []);
  const windowCount = timeWindows.length;

  const dayKeys = useMemo(() => [anchorDate, addDaysToKey(anchorDate, 1)] as const, [anchorDate]);

  const dayDates = useMemo(
    () => dayKeys.map((k) => new Date(`${k}T12:00:00`)),
    [dayKeys]
  );

  const tasksByDay = useMemo(() => {
    const map: Record<string, WorkCalendarTwoDayTask[]> = { [dayKeys[0]]: [], [dayKeys[1]]: [] };
    for (const task of tasks) {
      const key = task.scheduledDate.slice(0, 10);
      if (map[key]) map[key].push(task);
    }
    return map;
  }, [tasks, dayKeys]);

  const bucketsByDay = useMemo(() => {
    return {
      [dayKeys[0]]: groupTasksByWindows(tasksByDay[dayKeys[0]], windowCount),
      [dayKeys[1]]: groupTasksByWindows(tasksByDay[dayKeys[1]], windowCount),
    };
  }, [tasksByDay, dayKeys, windowCount]);

  const gridBodyHeight = windowCount * PX_PER_WINDOW;
  const monthTitle = hebrewMonthYear(dayDates[0]);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm', className)} dir="rtl">
      <header className="shrink-0 border-b border-slate-200/90 bg-white px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-right">
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">{monthTitle}</h2>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">חלונות {WINDOW_HOURS} שעות • משימות באותו חלון מאוחדות</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
            <button
              type="button"
              onClick={() => onAnchorChange(addDaysToKey(anchorDate, -1))}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
              aria-label="יום קודם"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-orange-600 transition-colors hover:bg-white"
            >
              היום
            </button>
            <button
              type="button"
              onClick={() => onAnchorChange(addDaysToKey(anchorDate, 1))}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
              aria-label="יום הבא"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className="mt-3 grid gap-0 border-b border-slate-100 pb-2"
          style={{
            gridTemplateColumns: `52px minmax(0,1fr) minmax(0,1fr)`,
          }}
        >
          <div />
          {dayDates.map((d, i) => {
            const key = dayKeys[i];
            const today = isSameDayKey(key);
            const hebHint = hebrewCalendarDayHint(d);
            return (
              <div key={key} className="min-w-0 border-l border-slate-100 pl-2 text-center first:border-l-0">
                <div className="text-[11px] font-semibold text-slate-500">{hebrewWeekdayShort(d)}</div>
                <div
                  className={cn(
                    'mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-black tabular-nums',
                    today ? 'bg-[#ea4335] text-on-dark' : 'text-slate-900'
                  )}
                >
                  {d.getDate()}
                </div>
                {hebHint ? (
                  <div className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-400">{hebHint}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </header>

      <div className="min-h-[min(70vh,560px)] flex-1 overflow-y-auto overscroll-contain">
        <div className="flex">
          <div
            className="w-[52px] shrink-0 border-l border-slate-100 bg-white"
            style={{ height: gridBodyHeight }}
          >
            {timeWindows.map((w) => (
              <div
                key={w.label}
                className="flex items-start justify-center border-b border-slate-100/90 px-0.5 pt-2 text-center"
                style={{ height: PX_PER_WINDOW }}
              >
                <span className="text-[9px] font-semibold leading-tight tabular-nums text-slate-400">
                  {w.label}
                </span>
              </div>
            ))}
          </div>

          <div
            className="grid min-w-0 flex-1"
            style={{
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
              height: gridBodyHeight,
            }}
          >
            {dayKeys.map((dayKey) => (
              <div key={dayKey} className="flex min-h-0 flex-col border-l border-slate-100 first:border-l-0">
                {timeWindows.map((w, wi) => {
                  const bucket = bucketsByDay[dayKey][wi];
                  const hasMany = bucket.length > 1;

                  return (
                    <div
                      key={w.label}
                      className="flex min-h-0 flex-col border-b border-slate-100/90 p-1"
                      style={{ height: PX_PER_WINDOW, minHeight: PX_PER_WINDOW }}
                    >
                      {bucket.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-100 bg-slate-50/40">
                          <span className="text-[10px] text-slate-300">—</span>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]',
                            hasMany && 'ring-1 ring-slate-100'
                          )}
                        >
                          {hasMany ? (
                            <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-2 py-1 text-center">
                              <span className="text-[10px] font-black text-slate-500">
                                {bucket.length} משימות בחלון
                              </span>
                            </div>
                          ) : null}
                          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
                            {bucket.map((task) => {
                              const kind = calendarJobKind(task.order.status);
                              const shell =
                                TASK_SHELL_CLASS[task.status] ?? TASK_SHELL_CLASS.DEFAULT;
                              const showComplete =
                                task.status !== 'COMPLETED' && task.status !== 'CANCELLED';

                              return (
                                <div
                                  key={task.id}
                                  className={cn(
                                    'rounded-md border border-slate-100/90 text-right',
                                    shell
                                  )}
                                >
                                  <div className="flex items-start gap-1.5 p-1.5">
                                    <Link
                                      href={`/orders/${task.order.id}`}
                                      className="min-w-0 flex-1"
                                    >
                                      <div className="flex flex-wrap items-center justify-end gap-1">
                                        <span
                                          className={cn(
                                            'rounded-full px-1.5 py-0.5 text-[9px] font-black',
                                            kind === 'install'
                                              ? 'bg-sky-100 text-sky-900'
                                              : 'bg-orange-100 text-orange-950'
                                          )}
                                        >
                                          {kind === 'install' ? 'התקנה' : 'משלוח'}
                                        </span>
                                        {task.status === 'COMPLETED' ? (
                                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold text-emerald-800">
                                            הושלם
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900">
                                        {task.order.customerName || 'ללא לקוח'}
                                      </p>
                                      <p className="truncate text-[10px] text-slate-500">
                                        {task.order.city?.trim() || 'ללא עיר'}
                                      </p>
                                    </Link>
                                    {showComplete ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          onCompleteTask(task.id);
                                        }}
                                        disabled={completePending}
                                        className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200/70 transition hover:bg-emerald-100 disabled:opacity-50"
                                        title="סמן הושלם"
                                      >
                                        ✓
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { WorkCalendarTwoDayGrid } from '@/components/calendar/WorkCalendarTwoDayGrid';
import { ListPageTemplate } from '@/components/layout/ListPageTemplate';
import { SmartSchedulePlanner } from '@/components/orders/ops/SmartSchedulePlanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/card';
import apiClient from '@/lib/apiClient';
import { dispatchOpenMobileNav } from '@/lib/navigation/mobileNav';
import { dispatchNotificationsRefresh } from '@/lib/notifications/browser';
import { buildScheduleWindowPayload } from '@/components/orders/ops/workflow/utils';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface TaskOrder {
  id: string;
  number: string;
  customerName: string | null;
  city: string | null;
  addressLine?: string | null;
  addressRaw?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
}

interface Technician {
  id: string;
  name: string;
  email?: string;
}

interface InstallationTask {
  id: string;
  scheduledDate: string;
  timeSlot?: string | null;
  durationMinutes?: number | null;
  status: string;
  notes?: string | null;
  order: TaskOrder;
  technician?: Technician | null;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function padTimePart(value: number) {
  return String(value).padStart(2, '0');
}

function addDaysToDateKey(key: string, delta: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function buildManualSchedulePayload(scheduledDateValue: string, durationMinutes: number) {
  if (!scheduledDateValue) return null;

  const scheduledAt = new Date(scheduledDateValue);
  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  const scheduledEnd = new Date(scheduledAt.getTime() + Math.max(durationMinutes, 30) * 60_000);
  const timeWindowStart = `${padTimePart(scheduledAt.getHours())}:${padTimePart(scheduledAt.getMinutes())}`;
  const timeWindowEnd = `${padTimePart(scheduledEnd.getHours())}:${padTimePart(scheduledEnd.getMinutes())}`;

  return {
    scheduledAtIso: scheduledAt.toISOString(),
    scheduledEndIso: scheduledEnd.toISOString(),
    timeWindowStart,
    timeWindowEnd,
  };
}

async function fetchCalendarTasks(startDate: string, endDate: string) {
  const url = new URL('/api/work-calendar/tasks', window.location.origin);
  url.searchParams.set('dateFrom', startDate);
  url.searchParams.set('dateTo', endDate);
  const res = await apiClient(url.toString());
  const payload = await res.json();
  if (!payload.success) throw new Error(payload.error?.message || 'שגיאה בטעינת היומן');
  return {
    tasks: Array.isArray(payload.data?.tasks) ? (payload.data.tasks as InstallationTask[]) : [],
    backlog: Array.isArray(payload.data?.backlog) ? (payload.data.backlog as TaskOrder[]) : [],
  };
}

async function fetchTechnicians(): Promise<Technician[]> {
  const res = await apiClient('/api/users?role=OPERATIONS&active=true');
  const data = await res.json();
  return data.success ? (data.data ?? []) : [];
}

const calendarSelectClass =
  'h-10 w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--card-bg)] px-3 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-colors focus:border-[var(--color-primary-600)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-600)]';

interface WorkCalendarHeaderActionsProps {
  isFetching: boolean;
  showNewTaskForm: boolean;
  onRefresh: () => void;
  onToggleForm: () => void;
}

function WorkCalendarHeaderActions({
  isFetching,
  showNewTaskForm,
  onRefresh,
  onToggleForm,
}: WorkCalendarHeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" asChild className="gap-1.5">
        <Link href="/deliveries">
          <Truck className="h-4 w-4 shrink-0" />
          <span className="hidden xs:inline">משלוחים</span>
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="gap-1.5 lg:hidden"
        onClick={() => dispatchOpenMobileNav()}
        aria-label="פתח תפריט ניווט"
      >
        <Menu className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">תפריט</span>
      </Button>
      <Button size="icon" variant="ghost" onClick={onRefresh} title="רענן">
        <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
      </Button>
      <Button size="sm" variant="warning" onClick={onToggleForm} className="gap-1.5">
        {showNewTaskForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        <span className="hidden sm:inline">{showNewTaskForm ? 'ביטול' : 'משימה חדשה'}</span>
      </Button>
    </div>
  );
}

interface WorkCalendarSummaryProps {
  totalTasks: number;
  completedTasks: number;
  backlogCount: number;
}

function WorkCalendarSummary({
  totalTasks,
  completedTasks,
  backlogCount,
}: WorkCalendarSummaryProps) {
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
        <span>
          <span className="font-semibold text-[var(--color-text-primary)]">{totalTasks}</span>{' '}
          משימות בטווח
        </span>
        <span className="text-[var(--color-text-tertiary)]">|</span>
        <span>
          <span className="font-semibold text-[var(--color-success-600)]">{completedTasks}</span>{' '}
          הושלמו
        </span>
        {backlogCount > 0 ? (
          <>
            <span className="text-[var(--color-text-tertiary)]">|</span>
            <span className="font-semibold text-[var(--color-warning-600)]">
              {backlogCount} ממתינות לתיאום
            </span>
          </>
        ) : null}
      </div>
    </Card>
  );
}

interface WorkCalendarErrorProps {
  message: string;
  onRetry: () => void;
}

function WorkCalendarError({ message, onRetry }: WorkCalendarErrorProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-danger-500)]/20 bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      <Button size="sm" variant="ghost" onClick={onRetry} className="me-auto h-7 text-[var(--color-danger-700)]">
        נסה שוב
      </Button>
    </div>
  );
}

interface WorkCalendarTaskFormProps {
  backlog: TaskOrder[];
  technicians: Technician[];
  newTask: {
    orderId: string;
    scheduledDate: string;
    technicianId: string;
    durationMinutes: number;
    notes: string;
  };
  recommendedDate: string;
  recommendedWindow: string;
  useManualScheduling: boolean;
  createPending: boolean;
  createError: Error | null;
  isTaskTimingReady: boolean;
  onNewTaskChange: (nextTask: {
    orderId: string;
    scheduledDate: string;
    technicianId: string;
    durationMinutes: number;
    notes: string;
  }) => void;
  onRecommendedDateChange: (value: string) => void;
  onRecommendedWindowChange: (value: string) => void;
  onUseManualSchedulingChange: (value: boolean) => void;
  onCancel: () => void;
  onCreate: () => void;
}

function WorkCalendarTaskForm({
  backlog,
  technicians,
  newTask,
  recommendedDate,
  recommendedWindow,
  useManualScheduling,
  createPending,
  createError,
  isTaskTimingReady,
  onNewTaskChange,
  onRecommendedDateChange,
  onRecommendedWindowChange,
  onUseManualSchedulingChange,
  onCancel,
  onCreate,
}: WorkCalendarTaskFormProps) {
  return (
    <Card className="space-y-4 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
        <Plus className="h-4 w-4 text-[var(--color-accent-500)]" />
        הקצאת משימה חדשה
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">הזמנה*</label>
          <select
            value={newTask.orderId}
            onChange={(event) => {
              const nextOrderId = event.target.value;
              onNewTaskChange({
                ...newTask,
                orderId: nextOrderId,
                scheduledDate: '',
              });
              onRecommendedDateChange('');
              onRecommendedWindowChange('');
              onUseManualSchedulingChange(false);
            }}
            className={calendarSelectClass}
          >
            <option value="">בחר הזמנה...</option>
            {backlog.map((order) => (
              <option key={order.id} value={order.id}>
                #{order.number} — {order.customerName || 'ללא לקוח'} ({order.city || 'ללא עיר'})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">טכנאי</label>
          <select
            value={newTask.technicianId}
            onChange={(event) => onNewTaskChange({ ...newTask, technicianId: event.target.value })}
            className={calendarSelectClass}
          >
            <option value="">ללא שיבוץ</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">משך (דקות)</label>
          <Input
            type="number"
            min={30}
            step={30}
            value={newTask.durationMinutes}
            onChange={(event) =>
              onNewTaskChange({ ...newTask, durationMinutes: Number(event.target.value) })
            }
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">הערות</label>
          <Input
            value={newTask.notes}
            onChange={(event) => onNewTaskChange({ ...newTask, notes: event.target.value })}
            placeholder="הערה אופציונלית..."
            className="h-10 text-sm"
          />
        </div>
      </div>

      {newTask.orderId ? (
        <Card className="space-y-4 p-4">
          <SmartSchedulePlanner
            orderId={newTask.orderId}
            scheduledDate={recommendedDate}
            setScheduledDate={onRecommendedDateChange}
            scheduleWindow={recommendedWindow}
            setScheduleWindow={onRecommendedWindowChange}
            existingSchedule={null}
            disabled={createPending}
          />

          <Card className="p-3">
            <button
              type="button"
              onClick={() => onUseManualSchedulingChange(!useManualScheduling)}
              className="flex w-full items-center justify-between gap-3 text-right"
            >
              <div>
                <div className="text-sm font-bold text-[var(--color-text-primary)]">
                  קביעת שעה ידנית
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  השתמש בזה רק אם חייבים לחרוג מהחלונות המומלצים ולבחור שעה מדויקת.
                </div>
              </div>
              <span className="text-xs font-bold text-[var(--color-accent-500)]">
                {useManualScheduling ? 'הסתר' : 'פתח'}
              </span>
            </button>

            {useManualScheduling ? (
              <div className="mt-4 space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  תאריך ושעה מדויקים*
                </label>
                <Input
                  type="datetime-local"
                  value={newTask.scheduledDate}
                  onChange={(event) => onNewTaskChange({ ...newTask, scheduledDate: event.target.value })}
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  גם במצב ידני, השרת יבדוק קיבולת מסלול ושעות עבודה לפני שמירה.
                </p>
              </div>
            ) : null}
          </Card>
        </Card>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 py-5 text-sm font-medium text-[var(--color-text-secondary)]">
          בחר הזמנה כדי לקבל חלונות התקנה מומלצים מתוך המסלול הקיים.
        </div>
      )}

      {createError ? (
        <p className="rounded-lg border border-[var(--color-danger-500)]/20 bg-[var(--color-danger-50)] px-3 py-2 text-xs text-[var(--color-danger-700)]">
          {createError.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          ביטול
        </Button>
        <Button
          size="sm"
          variant="warning"
          onClick={onCreate}
          disabled={!newTask.orderId || !isTaskTimingReady || createPending}
          className="gap-1.5"
        >
          {createPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          הקצה משימה
        </Button>
      </div>
    </Card>
  );
}

export function WorkCalendarPageContainer() {
  const queryClient = useQueryClient();
  const [anchorDate, setAnchorDate] = useState(getTodayString());
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    orderId: '',
    scheduledDate: '',
    technicianId: '',
    durationMinutes: 120,
    notes: '',
  });
  const [recommendedDate, setRecommendedDate] = useState('');
  const [recommendedWindow, setRecommendedWindow] = useState('');
  const [useManualScheduling, setUseManualScheduling] = useState(false);

  const rangeEnd = useMemo(() => addDaysToDateKey(anchorDate, 1), [anchorDate]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['work-calendar', anchorDate, '2d'],
    queryFn: () => fetchCalendarTasks(anchorDate, rangeEnd),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: fetchTechnicians,
    staleTime: 5 * 60_000,
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiClient(`/api/work-calendar/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error?.message || 'עדכון נכשל');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['work-calendar'] });
      dispatchNotificationsRefresh();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const durationMinutes = Number(newTask.durationMinutes) || 120;
      const schedulePayload = useManualScheduling
        ? buildManualSchedulePayload(newTask.scheduledDate, durationMinutes)
        : buildScheduleWindowPayload(recommendedDate, recommendedWindow);

      if (!newTask.orderId || !schedulePayload) {
        throw new Error('בחר מועד תואם לפני יצירת המשימה');
      }

      const res = await apiClient(`/api/orders/${newTask.orderId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: schedulePayload.scheduledAtIso,
          scheduledEnd: schedulePayload.scheduledEndIso,
          scheduleMode: 'TIME_WINDOW',
          timeWindowStart: schedulePayload.timeWindowStart,
          timeWindowEnd: schedulePayload.timeWindowEnd,
          durationMinutes,
          installerId: newTask.technicianId || null,
          installerNotes: newTask.notes || null,
          notesToCrew: newTask.notes || undefined,
          status: 'SCHEDULED',
        }),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error?.message || 'יצירה נכשלה');
    },
    onSuccess: async () => {
      setNewTask({
        orderId: '',
        scheduledDate: '',
        technicianId: '',
        durationMinutes: 120,
        notes: '',
      });
      setRecommendedDate('');
      setRecommendedWindow('');
      setUseManualScheduling(false);
      setShowNewTaskForm(false);
      await queryClient.invalidateQueries({ queryKey: ['work-calendar'] });
      dispatchNotificationsRefresh();
    },
  });

  useEffect(() => {
    if (showNewTaskForm) return;
    setRecommendedDate('');
    setRecommendedWindow('');
    setUseManualScheduling(false);
    setNewTask({
      orderId: '',
      scheduledDate: '',
      technicianId: '',
      durationMinutes: 120,
      notes: '',
    });
  }, [showNewTaskForm]);

  const totalTasks = data?.tasks.length ?? 0;
  const completedTasks = data?.tasks.filter((task) => task.status === 'COMPLETED').length ?? 0;
  const backlogCount = data?.backlog.length ?? 0;
  const isTaskTimingReady = useManualScheduling
    ? Boolean(newTask.scheduledDate)
    : Boolean(recommendedDate && recommendedWindow);
  const auxiliaryPanel =
    error || showNewTaskForm ? (
      <div className="space-y-4">
        {error ? (
          <WorkCalendarError
            message={error instanceof Error ? error.message : 'שגיאה בטעינת הנתונים'}
            onRetry={() => void refetch()}
          />
        ) : null}
        {showNewTaskForm ? (
          <WorkCalendarTaskForm
            backlog={data?.backlog ?? []}
            technicians={technicians}
            newTask={newTask}
            recommendedDate={recommendedDate}
            recommendedWindow={recommendedWindow}
            useManualScheduling={useManualScheduling}
            createPending={createMutation.isPending}
            createError={createMutation.error ?? null}
            isTaskTimingReady={isTaskTimingReady}
            onNewTaskChange={setNewTask}
            onRecommendedDateChange={setRecommendedDate}
            onRecommendedWindowChange={setRecommendedWindow}
            onUseManualSchedulingChange={setUseManualScheduling}
            onCancel={() => setShowNewTaskForm(false)}
            onCreate={() => createMutation.mutate()}
          />
        ) : null}
      </div>
    ) : undefined;

  return (
    <ListPageTemplate
      title="יומן עבודה"
      description="תצוגת שני ימים, תכנון חלונות התקנה ושיבוץ ישיר מתוך אותם רכיבי עמוד משותפים."
      className="pb-6 lg:pb-16"
      headerActions={
        <WorkCalendarHeaderActions
          isFetching={isFetching}
          showNewTaskForm={showNewTaskForm}
          onRefresh={() => void refetch()}
          onToggleForm={() => setShowNewTaskForm((current) => !current)}
        />
      }
      stats={
        <WorkCalendarSummary
          totalTasks={totalTasks}
          completedTasks={completedTasks}
          backlogCount={backlogCount}
        />
      }
      filters={auxiliaryPanel}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent-500)]" />
        </div>
      ) : (
        <WorkCalendarTwoDayGrid
          anchorDate={anchorDate}
          onAnchorChange={setAnchorDate}
          onToday={() => setAnchorDate(getTodayString())}
          tasks={data?.tasks ?? []}
          onCompleteTask={(taskId) => completeMutation.mutate(taskId)}
          completePending={completeMutation.isPending}
        />
      )}
    </ListPageTemplate>
  );
}

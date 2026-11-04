'use client';

import { EntityBadge, EntityNotice } from '@/components/shared/display/EntityPrimitives';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, Loader2, Sparkles } from 'lucide-react';
import { startTransition, useEffect, useMemo, useState } from 'react';

import type {
  SmartScheduleManualDateOption,
  SmartScheduleRecommendation,
} from '@/lib/orders/smartSchedule';
import { buildDateOnlyShortcut, DELIVERY_WINDOW_OPTIONS } from './workflow/utils';

type SmartScheduleRecommendationsData = {
  recommendations: SmartScheduleRecommendation[];
  dates: SmartScheduleManualDateOption[];
  businessHours: {
    label: string;
    start: string;
    end: string;
    timezone: string;
    capacityLimitMinutes: number;
    operationalRouteLimitMinutes: number;
  };
};

function formatRelativeDateLabel(dateValue: string) {
  const target = new Date(`${dateValue}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const compareTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round(
    (compareTarget.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'מחר';
  if (diffDays === 2) return 'מחרתיים';

  return target.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
}

function buildFallbackDates(): SmartScheduleManualDateOption[] {
  return Array.from({ length: 4 }, (_, index) => ({
    dateValue: buildDateOnlyShortcut(index + 1),
    windowOptions: DELIVERY_WINDOW_OPTIONS.map((windowOption, windowIndex) => ({
      value: windowOption.value,
      label:
        windowIndex === 0
          ? `בוקר • ${windowOption.value}`
          : windowIndex === 1
            ? `אמצע יום • ${windowOption.value}`
            : `חלון ${windowIndex + 1} • ${windowOption.value}`,
      start: windowOption.value.split('-')[0] ?? '09:00',
      end: windowOption.value.split('-')[1] ?? '12:00',
      loadCount: 0,
      dayLoadCount: 0,
      nearestClusterDistanceKm: null,
      projectedWorkloadMinutes: 0,
      remainingCapacityMinutes: 0,
      insertionMinutes: 0,
      disabled: false,
      reason: null,
      isRecommended: index === 0 && windowIndex < 2,
    })),
  }));
}

async function fetchSmartScheduleRecommendations(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}/schedule/recommendations?limit=4&days=6`, {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || 'Failed to load schedule recommendations');
  }

  return payload.data as SmartScheduleRecommendationsData;
}

interface SmartSchedulePlannerProps {
  orderId: string;
  scheduledDate: string;
  setScheduledDate: (value: string) => void;
  scheduleWindow: string;
  setScheduleWindow: (value: string) => void;
  existingSchedule: string | Date | null;
  disabled?: boolean;
}

export function SmartSchedulePlanner({
  orderId,
  scheduledDate,
  setScheduledDate,
  scheduleWindow,
  setScheduleWindow,
  existingSchedule,
  disabled = false,
}: Readonly<SmartSchedulePlannerProps>) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fallbackDateOptions = useMemo(() => buildFallbackDates(), []);
  const recommendationsQuery = useQuery({
    queryKey: ['orders', orderId, 'schedule-recommendations'],
    queryFn: () => fetchSmartScheduleRecommendations(orderId),
    enabled: Boolean(orderId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const dateOptions = recommendationsQuery.data?.dates ?? fallbackDateOptions;
  const recommendations = useMemo(
    () => recommendationsQuery.data?.recommendations ?? [],
    [recommendationsQuery.data?.recommendations]
  );
  const availableSlotKeys = useMemo(
    () =>
      new Set(
        dateOptions.flatMap((dateOption) =>
          dateOption.windowOptions
            .filter((windowOption) => !windowOption.disabled)
            .map((windowOption) => `${dateOption.dateValue}__${windowOption.value}`)
        )
      ),
    [dateOptions]
  );
  const selectedDateOption =
    dateOptions.find((dateOption) => dateOption.dateValue === scheduledDate) ??
    dateOptions[0] ??
    null;
  const selectedWindowOption =
    selectedDateOption?.windowOptions.find((windowOption) => windowOption.value === scheduleWindow) ??
    selectedDateOption?.windowOptions.find((windowOption) => !windowOption.disabled) ??
    null;
  const currentSelectionKey = `${scheduledDate}__${scheduleWindow}`;

  useEffect(() => {
    if (existingSchedule) return;
    if (availableSlotKeys.has(currentSelectionKey)) return;

    const fallbackSelection =
      recommendations[0] ??
      dateOptions
        .flatMap((dateOption) =>
          dateOption.windowOptions
            .filter((windowOption) => !windowOption.disabled)
            .map((windowOption) => ({
              dateValue: dateOption.dateValue,
              windowValue: windowOption.value,
            }))
        )
        .at(0);

    if (!fallbackSelection) return;

    startTransition(() => {
      setScheduledDate(fallbackSelection.dateValue);
      setScheduleWindow(fallbackSelection.windowValue);
    });
  }, [
    availableSlotKeys,
    currentSelectionKey,
    dateOptions,
    existingSchedule,
    recommendations,
    setScheduledDate,
    setScheduleWindow,
  ]);

  const applySelection = (dateValue: string, windowValue: string) => {
    startTransition(() => {
      setScheduledDate(dateValue);
      setScheduleWindow(windowValue);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#f8fafc_100%)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <EntityBadge label="תיאום חכם" tone="info" />
              {recommendationsQuery.data?.businessHours ? (
                <span className="text-[11px] font-bold text-slate-500">
                  שעות מסלול: {recommendationsQuery.data.businessHours.label}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              המערכת מציעה רק חלונות שנכנסים ביום העבודה ומשתלבים הכי טוב במסלול הקיים.
            </p>
          </div>
          {recommendationsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
          ) : (
            <Sparkles className="h-5 w-5 text-primary-500" />
          )}
        </div>

        {recommendationsQuery.isError ? (
          <EntityNotice
            icon={AlertCircle}
            tone="warning"
            title="לא הצלחתי לטעון המלצות חכמות כרגע"
            description="אפשר עדיין לבחור חלון זמין ידנית."
          />
        ) : null}

        {recommendations.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recommendations.map((recommendation, index) => {
              const isActive =
                scheduledDate === recommendation.dateValue &&
                scheduleWindow === recommendation.windowValue;

              return (
                <button
                  key={recommendation.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => applySelection(recommendation.dateValue, recommendation.windowValue)}
                  className={cn(
                    'rounded-[20px] border px-4 py-4 text-right shadow-sm transition-all',
                    isActive
                      ? 'border-primary-100 bg-primary-50 ring-2 ring-primary-100'
                      : 'border-white/80 bg-white/80 hover:border-sky-200 hover:bg-white'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <EntityBadge
                        label={index === 0 ? 'הכי מומלץ' : index === 1 ? 'חלופה טובה' : 'אפשרות נוספת'}
                        tone={index === 0 ? 'success' : 'info'}
                        size="sm"
                      />
                      <div className="mt-2 text-sm font-black text-slate-900">{recommendation.title}</div>
                    </div>
                    {isActive ? <CheckCircle2 className="h-5 w-5 text-primary-600" /> : null}
                  </div>

                  <div className="mt-3 text-base font-black text-slate-900">{formatRelativeDateLabel(recommendation.dateValue)}</div>
                  <div className="mt-1 text-sm font-bold text-slate-700">
                    {recommendation.windowStart}-{recommendation.windowEnd}
                  </div>
                  <div className="mt-2 text-[12px] font-medium leading-5 text-slate-600">
                    {recommendation.hint}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <EntityBadge
                      label={
                        recommendation.loadCount === 0
                          ? 'חלון פנוי'
                          : `${recommendation.loadCount} משלוחים בחלון`
                      }
                      tone="neutral"
                      size="sm"
                    />
                    <EntityBadge
                      label={`מרווח ${Math.max(0, recommendation.remainingCapacityMinutes)} דק׳`}
                      tone="success"
                      size="sm"
                    />
                    {typeof recommendation.nearestClusterDistanceKm === 'number' ? (
                      <EntityBadge
                        label={`מרחק ~${recommendation.nearestClusterDistanceKm.toFixed(1)} ק״מ`}
                        tone="info"
                        size="sm"
                      />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : recommendationsQuery.isLoading ? (
          <EntityNotice
            icon={Loader2}
            tone="neutral"
            title="מחשב חלונות תיאום"
            description="בודק זמינות לפי המסלולים הקיימים."
            className="text-center"
          />
        ) : (
          <EntityNotice
            icon={AlertCircle}
            tone="warning"
            title="לא נמצאו חלונות שמומלץ להציע כרגע"
            description="אפשר לפתוח תיאום מתקדם ולבחור חלון זמין."
          />
        )}
      </div>

      {selectedDateOption && selectedWindowOption ? (
        <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Clock3 className="h-4 w-4 text-primary-600" />
            המועד שיישמר כרגע
          </div>
          <div className="mt-2 text-base font-black text-slate-900">{formatRelativeDateLabel(selectedDateOption.dateValue)}</div>
          <div className="mt-1 text-sm font-bold text-slate-700">
            {selectedWindowOption.start}-{selectedWindowOption.end}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <EntityBadge label={`${selectedWindowOption.dayLoadCount} עצירות באותו יום`} tone="neutral" size="sm" />
            <EntityBadge
              label={`עומס משוער ${selectedWindowOption.projectedWorkloadMinutes} דק׳`}
              tone="info"
              size="sm"
            />
            <EntityBadge
              label={`מרווח ${Math.max(0, selectedWindowOption.remainingCapacityMinutes)} דק׳`}
              tone="success"
              size="sm"
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-right"
        >
          <div>
            <div className="text-sm font-black text-slate-900">תיאום מתקדם</div>
            <div className="mt-1 text-xs font-medium text-slate-600">
              בחירה ידנית מתוך החלונות שהמערכת אישרה לפי עומס ומסלול.
            </div>
          </div>
          <div className="text-xs font-black text-primary-600">
            {showAdvanced ? 'הסתר' : 'פתח'}
          </div>
        </button>

        {showAdvanced ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {dateOptions.map((dateOption) => {
                const hasAvailableWindow = dateOption.windowOptions.some(
                  (windowOption) => !windowOption.disabled
                );

                return (
                  <button
                    key={dateOption.dateValue}
                    type="button"
                    disabled={disabled || !hasAvailableWindow}
                    onClick={() => {
                      const firstWindow = dateOption.windowOptions.find(
                        (windowOption) => !windowOption.disabled
                      );
                      if (!firstWindow) return;
                      applySelection(dateOption.dateValue, firstWindow.value);
                    }}
                    className={cn(
                      'rounded-full border px-3 py-2 text-xs font-black shadow-sm transition-colors',
                      scheduledDate === dateOption.dateValue
                        ? 'border-primary-100 bg-primary-50 text-primary-600'
                        : hasAvailableWindow
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          : 'border-slate-200 bg-slate-100 text-slate-400'
                    )}
                  >
                    {formatRelativeDateLabel(dateOption.dateValue)}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(selectedDateOption?.windowOptions ?? []).map((windowOption) => {
                const isActive = scheduleWindow === windowOption.value;

                return (
                  <button
                    key={`${selectedDateOption?.dateValue}-${windowOption.value}`}
                    type="button"
                    disabled={disabled || windowOption.disabled}
                    onClick={() => {
                      if (!selectedDateOption || windowOption.disabled) return;
                      applySelection(selectedDateOption.dateValue, windowOption.value);
                    }}
                    className={cn(
                      'rounded-[18px] border px-4 py-3 text-right shadow-sm transition-colors',
                      isActive
                        ? 'border-primary-100 bg-primary-50'
                        : windowOption.disabled
                          ? 'border-slate-200 bg-slate-100 text-slate-400'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                    )}
                  >
                    <div className="text-sm font-black text-slate-900">{windowOption.label}</div>
                    <div className="mt-1 text-[12px] font-medium text-slate-600">
                      {windowOption.loadCount === 0
                        ? 'כרגע ללא עצירות בחלון הזה'
                        : `${windowOption.loadCount} עצירות כבר משובצות בחלון`}
                    </div>
                    {windowOption.disabled && windowOption.reason ? (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {windowOption.reason}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/ToastProvider';
import { FulfillmentType, InstallationSchedulePayload, ScheduleMode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CalendarCheck2, Loader2, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface SchedulingCardProps {
  orderId: string;
  initialScheduledAt?: Date | string | null;
  initialScheduledEnd?: Date | string | null;
  initialFulfillmentType?: FulfillmentType;
  initialScheduleMode?: ScheduleMode;
  initialTimeWindowStart?: string | null;
  initialTimeWindowEnd?: string | null;
  initialNotesToCrew?: string | null;
  initialStatus?: string | null;
  initialDurationMinutes?: number | null;
  initialInstallerName?: string | null;
  initialInstallerNotes?: string | null;
  initialInstallerId?: string | null;
  disabled?: boolean;
  onUpdated?: () => void;
  className?: string;
}

export function SchedulingCard({
  orderId,
  initialScheduledAt,
  initialScheduledEnd,
  initialFulfillmentType = 'INSTALLATION',
  initialScheduleMode = 'TIME_WINDOW',
  initialTimeWindowStart,
  initialTimeWindowEnd,
  initialNotesToCrew,
  initialStatus,
  initialDurationMinutes,
  initialInstallerName,
  initialInstallerNotes,
  initialInstallerId,
  disabled = false,
  onUpdated,
  className,
}: SchedulingCardProps) {
  const toast = useToast();
  const router = useRouter();

  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(
    initialScheduledAt ? new Date(initialScheduledAt) : undefined
  );

  // For TIME_WINDOW input
  const [dateStr, setDateStr] = useState<string>(
    initialScheduledAt ? new Date(initialScheduledAt).toISOString().split('T')[0] : ''
  );

  const [scheduledEnd, setScheduledEnd] = useState<Date | undefined>(
    initialScheduledEnd ? new Date(initialScheduledEnd) : undefined
  );
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(initialFulfillmentType);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(initialScheduleMode);
  const [duration, setDuration] = useState<number>(initialDurationMinutes || 60);

  const [timeWindowStart, setTimeWindowStart] = useState<string>(initialTimeWindowStart ?? '');
  const [timeWindowEnd, setTimeWindowEnd] = useState<string>(initialTimeWindowEnd ?? '');
  const [notesToCrew, setNotesToCrew] = useState<string>(initialNotesToCrew ?? '');

  const [installerName, setInstallerName] = useState<string>(initialInstallerName ?? '');
  const [installerNotes, setInstallerNotes] = useState<string>(initialInstallerNotes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScheduledAt(initialScheduledAt ? new Date(initialScheduledAt) : undefined);
    setDateStr(initialScheduledAt ? new Date(initialScheduledAt).toISOString().split('T')[0] : '');
    setScheduledEnd(initialScheduledEnd ? new Date(initialScheduledEnd) : undefined);
    setFulfillmentType(initialFulfillmentType);
    setScheduleMode(initialScheduleMode);
    setDuration(initialDurationMinutes || (initialFulfillmentType === 'DELIVERY' ? 20 : 60));
    setInstallerName(initialInstallerName ?? '');
    setInstallerNotes(initialInstallerNotes ?? '');
    setTimeWindowStart(initialTimeWindowStart ?? '');
    setTimeWindowEnd(initialTimeWindowEnd ?? '');
    setNotesToCrew(initialNotesToCrew ?? '');
  }, [
    initialScheduledAt,
    initialScheduledEnd,
    initialFulfillmentType,
    initialScheduleMode,
    initialDurationMinutes,
    initialInstallerName,
    initialInstallerNotes,
    initialTimeWindowStart,
    initialTimeWindowEnd,
    initialNotesToCrew,
  ]);

  const submitUpdate = useCallback(
    async (payload: InstallationSchedulePayload) => {
      const res = await fetch(`/api/orders/${orderId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(
          json?.detail?.message || json?.error?.message || json?.error || 'Update failed'
        );
      }
      onUpdated?.();
      return res.json().catch(() => null);
    },
    [orderId, onUpdated]
  );

  const handleSave = async (confirm: boolean) => {
    if (disabled || saving) return;

    let finalScheduledAt = scheduledAt;
    let finalScheduledEnd = scheduledEnd;

    if (scheduleMode === 'TIME_WINDOW') {
      if (!dateStr) {
        toast.warning('חסר תאריך');
        return;
      }
      if (!timeWindowStart || !timeWindowEnd) {
        toast.warning('חסר חלון זמן (התחלה וסיום)');
        return;
      }
      // Use dateStr for scheduledAt
      finalScheduledAt = new Date(dateStr);
    } else {
      if (!finalScheduledAt) {
        toast.warning('חסר מועד מדויק');
        return;
      }
    }

    try {
      setSaving(true);
      const trimmedName = installerName.trim();
      const trimmedNotes = installerNotes.trim();
      const trimmedCrewNotes = notesToCrew.trim();

      // Calculate end time if Exact Mode and not set
      if (scheduleMode === 'SPECIFIC_TIME' && !finalScheduledEnd && finalScheduledAt && duration) {
        finalScheduledEnd = new Date(finalScheduledAt.getTime() + duration * 60000);
      }

      const result = await submitUpdate({
        scheduledAt: finalScheduledAt!.toISOString(),
        scheduledEnd: finalScheduledEnd?.toISOString(),
        fulfillmentType,
        scheduleMode,
        timeWindowStart: scheduleMode === 'TIME_WINDOW' ? timeWindowStart : null,
        timeWindowEnd: scheduleMode === 'TIME_WINDOW' ? timeWindowEnd : null,
        notesToCrew: trimmedCrewNotes || null,
        durationMinutes: duration,
        installerName: trimmedName || null,
        installerNotes: trimmedNotes || null,
        installerId: initialInstallerId,
        status: confirm ? 'SCHEDULED' : undefined,
      });

      toast.success(confirm ? 'ההזמנה תואמה' : 'נשמר כטיוטה');
      if (result?.data?.autoRebalanced?.count) {
        toast.success(
          'המסלול עודכן אוטומטית',
          `${result.data.autoRebalanced.count} משלוחים רחוקים יותר הועברו ליום הבא.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'שמירה נכשלה';
      toast.error('שגיאה', message);
    } finally {
      setSaving(false);
    }
  };

  const isScheduled = initialStatus === 'SCHEDULED';
  const isDraft = !isScheduled && !!initialScheduledAt;

  return (
    <Card
      className={cn(
        'p-0 border-4 border-slate-900 dark:border-slate-100 rounded-none overflow-hidden shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] dark:shadow-[8px_8px_0px_0px_rgba(248,250,252,1)] dark:bg-slate-950',
        className
      )}
    >
      <CardContent className="p-6 space-y-8">
        <div className="flex justify-between items-start border-b-4 border-slate-900 dark:border-slate-100 -mx-6 -mt-6 p-6 bg-slate-50 dark:bg-slate-900">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              תזמון ושילוח
              {isScheduled && (
                <Badge className="bg-green-400 text-slate-900 border-2 border-slate-900 rounded-none font-black px-3 py-1 uppercase tracking-widest text-[10px]">
                  MAPPED
                </Badge>
              )}
              {isDraft && (
                <Badge className="bg-amber-400 text-slate-900 border-2 border-slate-900 rounded-none font-black px-3 py-1 uppercase tracking-widest text-[10px]">
                  DRAFT
                </Badge>
              )}
              {!isScheduled && !isDraft && (
                <Badge className="bg-slate-200 text-slate-500 border-2 border-slate-400 rounded-none font-black px-3 py-1 uppercase tracking-widest text-[10px]">
                  UNMAPPED
                </Badge>
              )}
            </h3>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-1 opacity-60">
              LOGISTICS & INSTALLATION SCHEDULER
            </p>
          </div>
        </div>

        {/* Type & Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
              סוג שירות
            </Label>
            <Select
              value={fulfillmentType}
              onChange={(e) => {
                const newVal = e.target.value as FulfillmentType;
                setFulfillmentType(newVal);
                if (newVal === 'DELIVERY') setDuration(20);
                if (newVal === 'INSTALLATION') setDuration(60);
                if (newVal === 'PICKUP') setDuration(30);
              }}
              className="h-14 border-2 border-slate-900 rounded-none font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:border-slate-100"
              options={[
                { value: 'INSTALLATION', label: 'התקנה' },
                { value: 'DELIVERY', label: 'משלוח בלבד' },
                { value: 'PICKUP', label: 'איסוף עצמי' },
              ]}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
              אופן תזמון
            </Label>
            <div className="flex border-2 border-slate-900 p-1 bg-slate-100 dark:bg-slate-800 dark:border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setScheduleMode('TIME_WINDOW');
                  setScheduledEnd(undefined);
                }}
                className={cn(
                  'flex-1 text-[11px] font-black uppercase tracking-widest py-3 px-2 transition-all',
                  scheduleMode === 'TIME_WINDOW'
                    ? 'bg-slate-900 text-on-dark shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:bg-slate-100 dark:text-on-bright'
                    : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                חלון זמן
              </button>
              <button
                type="button"
                onClick={() => {
                  setScheduleMode('SPECIFIC_TIME');
                  setScheduledEnd(undefined);
                }}
                className={cn(
                  'flex-1 text-[11px] font-black uppercase tracking-widest py-3 px-2 transition-all',
                  scheduleMode === 'SPECIFIC_TIME'
                    ? 'bg-slate-900 text-on-dark shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:bg-slate-100 dark:text-on-bright'
                    : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                שעה מדויקת
              </button>
            </div>
          </div>
        </div>

        {/* Date & Time Inputs */}
        <div className="grid gap-8 md:grid-cols-2">
          {scheduleMode === 'TIME_WINDOW' ? (
            <>
              <div className="space-y-3">
                <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
                  תאריך
                </Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="h-14 border-2 border-slate-900 rounded-none font-black uppercase bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
                  חלון שעות
                </Label>
                <div className="flex items-stretch gap-2">
                  <Input
                    type="time"
                    value={timeWindowStart}
                    onChange={(e) => setTimeWindowStart(e.target.value)}
                    className="flex-1 h-14 border-2 border-slate-900 rounded-none font-black uppercase bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                  />
                  <div className="flex items-center justify-center px-2 font-black">TO</div>
                  <Input
                    type="time"
                    value={timeWindowEnd}
                    onChange={(e) => setTimeWindowEnd(e.target.value)}
                    className="flex-1 h-14 border-2 border-slate-900 rounded-none font-black uppercase bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
                מועד מדויק
              </Label>
              <div
                dir="ltr"
                className="p-1 border-2 border-slate-900 bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
              >
                <DateTimePicker
                  value={scheduledAt}
                  onChange={(d) => setScheduledAt(d || undefined)}
                  minDate={new Date()}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
              משך משוער (דקות)
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                min={5}
                step={5}
                className="h-14 border-2 border-slate-900 rounded-none font-black bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] pl-12"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                MINS
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
            שם המתקין / שליח
          </Label>
          <div className="relative">
            <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 stroke-[3px]" />
            <Input
              value={installerName}
              onChange={(e) => setInstallerName(e.target.value)}
              placeholder="ENTER CREW NAME..."
              disabled={disabled || saving}
              className="h-14 pr-12 border-2 border-slate-900 rounded-none font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
              הערות לצוות (יופיע ביומן)
            </Label>
            <Textarea
              value={notesToCrew}
              onChange={(e) => setNotesToCrew(e.target.value)}
              placeholder="FIELD NOTES FOR THE CREW..."
              rows={3}
              disabled={disabled || saving}
              className="border-2 border-slate-900 rounded-none font-bold uppercase p-4 bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] focus:ring-0"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-black uppercase tracking-widest text-on-bright underline decoration-4 underline-offset-4">
              הערות פנימיות (משרד)
            </Label>
            <Textarea
              value={installerNotes}
              onChange={(e) => setInstallerNotes(e.target.value)}
              placeholder="INTERNAL OFFICE CLARIFICATIONS..."
              rows={3}
              disabled={disabled || saving}
              className="border-2 border-slate-900 rounded-none font-bold uppercase p-4 bg-white dark:bg-slate-900 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] focus:ring-0"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch justify-end gap-3 pt-6 border-t-4 border-slate-900 dark:border-slate-100 -mx-6 mb-0 px-6 mt-12 bg-slate-50 text-on-bright dark:bg-slate-900">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={disabled || saving}
            className="h-14 border-4 border-slate-200 text-slate-400 font-black uppercase tracking-widest rounded-none hover:border-slate-900 hover:text-slate-900 dark:border-slate-800 dark:text-on-bright-muted dark:hover:border-slate-100 dark:hover:text-on-bright transition-all flex-1 sm:flex-none sm:min-w-[180px]"
          >
            SAV AS DRAFT
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={disabled || saving}
            className="h-14 bg-slate-900 text-on-dark border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all rounded-none font-black uppercase tracking-widest px-10 text-lg dark:bg-slate-100 dark:text-on-bright dark:border-slate-100 flex-1 sm:flex-none sm:min-w-[220px]"
          >
            {saving ? (
              <Loader2 className="w-6 h-6 mr-2 animate-spin" />
            ) : (
              <CalendarCheck2 className="w-6 h-6 mr-2 stroke-[3px]" />
            )}
            CONFIRM SCHEDULE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

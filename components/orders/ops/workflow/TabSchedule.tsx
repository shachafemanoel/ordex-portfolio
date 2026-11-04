import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Calendar, Loader2, MessageCircle, Phone } from 'lucide-react';
import { buildDateShortcut } from './utils';

interface TabScheduleProps {
  scheduledAt: string;
  setScheduledAt: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  existingSchedule: string | Date | null;
  customerPhone: string | null;
  whatsappPhone: string | null;
  onSubmit: () => void;
  isProcessing: boolean;
}

export default function TabSchedule({
  scheduledAt,
  setScheduledAt,
  notes,
  setNotes,
  existingSchedule,
  customerPhone,
  whatsappPhone,
  onSubmit,
  isProcessing,
}: TabScheduleProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">קביעת מועד אספקה</h3>
        {existingSchedule && (
          <Badge variant="success" className="text-[10px]">
            תואם: {new Date(existingSchedule).toLocaleString('he-IL')}
          </Badge>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">מועד תיאום</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScheduledAt(buildDateShortcut(0, 12, 0))}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
          >
            היום 12:00
          </button>
          <button
            type="button"
            onClick={() => setScheduledAt(buildDateShortcut(1, 9, 0))}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
          >
            מחר 09:00
          </button>
          <button
            type="button"
            onClick={() => setScheduledAt(buildDateShortcut(1, 12, 0))}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
          >
            מחר 12:00
          </button>
          <button
            type="button"
            onClick={() => setScheduledAt(buildDateShortcut(2, 9, 30))}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
          >
            עוד יומיים
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">הערות לצוות</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="לדוגמה: משלוח מחר בין 10:00-12:00"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-xs font-medium text-slate-700">פעולות מהירות ללקוח</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {whatsappPhone ? (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-10 touch-manipulation gap-2 border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"
              >
                <MessageCircle className="h-4 w-4" />
                הודעה בוואטסאפ
              </Button>
            </a>
          ) : null}
          {customerPhone ? (
            <a href={`tel:${customerPhone}`} className="inline-flex">
              <Button
                variant="outline"
                size="sm"
                className="h-10 touch-manipulation gap-2 border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"
              >
                <Phone className="h-4 w-4" />
                שיחה ללקוח
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <Button onClick={onSubmit} disabled={isProcessing || !scheduledAt}>
          {isProcessing ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <Calendar className="ml-2 h-4 w-4" />
          )}
          שמור תיאום
        </Button>
      </div>
    </div>
  );
}

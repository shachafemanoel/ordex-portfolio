'use client';

import { useOpsActions } from '@/hooks/useOpsActions';
import { Button } from '@/components/ui/Button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/Sheet';
import { Calendar } from '@/components/ui/calendar';
import { OrderModalStepHeader } from '@/components/orders/shared/OrderModalStepHeader';
import { cn } from '@/lib/utils';
import { Loader2, Truck } from 'lucide-react';
import { useState } from 'react';
import { addDays, startOfToday, isSameDay, format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

interface DeliverySchedulingModalProps {
  orderId: string;
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

const TIME_SLOTS = [
  { label: 'בוקר', range: '08:00–12:00' },
  { label: 'צהריים', range: '12:00–16:00' },
  { label: 'ערב', range: '16:00–20:00' },
];

export function DeliverySchedulingModal({
  orderId,
  actionId,
  open,
  onOpenChange,
  onCompleted,
}: DeliverySchedulingModalProps) {
  const { setDeliveryDate, isLoading } = useOpsActions(orderId);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!selectedDate) return;
    try {
      await setDeliveryDate(actionId, selectedDate);
      toast({ title: 'משלוח תואם בהצלחה', variant: 'success' });
      onCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'שגיאה בתיאום', description: e.message, variant: 'destructive' });
    }
  };

  const quickDates = [
    { label: 'היום', date: startOfToday() },
    { label: 'מחר', date: addDays(startOfToday(), 1) },
    { label: 'מחרתיים', date: addDays(startOfToday(), 2) },
    {
      label: 'ראשון הבא',
      date: addDays(startOfToday(), (7 - startOfToday().getDay() + 7) % 7),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-xl sm:max-w-md mx-auto flex flex-col"
        dir="rtl"
      >
        <SheetHeader className="text-right shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-100 rounded-lg">
              <Truck className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <SheetTitle>תיאום משלוח</SheetTitle>
              <SheetDescription>בחר תאריך ושעה למשלוח ההזמנה.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step context – delivery scheduling moves order to IN_TRANSIT */}
          <OrderModalStepHeader
            currentStatus="READY"
            targetStatus="IN_TRANSIT"
            description="תיאום תאריך משלוח יעביר את ההזמנה לשלב 'בדרך'"
            className="mb-4"
          />

          {/* Quick date chips */}
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {quickDates.map((qd, i) => (
              <button
                key={i}
                onClick={() => setSelectedDate(qd.date)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border',
                  selectedDate && isSameDay(selectedDate, qd.date)
                    ? 'bg-sky-50 border-sky-400 text-sky-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {qd.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="border rounded-xl p-3 mb-6 bg-white shadow-sm flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border-0"
              locale={he as any}
            />
          </div>

          {/* Time slots */}
          <div>
            <h4 className="font-bold text-sm mb-3 text-slate-900">
              חלון זמן מועדף{' '}
              <span className="text-slate-400 font-normal">(אופציונלי)</span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {TIME_SLOTS.map((slot) => {
                const key = `${slot.label} (${slot.range})`;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTimeSlot(key === selectedTimeSlot ? null : key)}
                    className={cn(
                      'p-3 rounded-lg text-xs font-medium border transition-all text-center leading-tight',
                      selectedTimeSlot === key
                        ? 'bg-sky-50 border-sky-400 text-sky-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="block font-bold text-sm">{slot.label}</span>
                    <span className="text-[11px] opacity-75">{slot.range}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected summary */}
          {selectedDate && (
            <div className="mt-4 p-3 bg-sky-50 border border-sky-100 rounded-lg text-sm text-sky-700">
              <span className="font-bold">משלוח מתוזמן:</span>{' '}
              {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: he })}
              {selectedTimeSlot && ` – ${selectedTimeSlot}`}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 pt-4 border-t border-slate-100 bg-white pb-6 sm:pb-0">
          <Button
            className="w-full h-12 text-base font-bold gap-2"
            disabled={isLoading || !selectedDate}
            onClick={handleConfirm}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Truck className="h-5 w-5" />
            )}
            אישור ותיאום משלוח
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

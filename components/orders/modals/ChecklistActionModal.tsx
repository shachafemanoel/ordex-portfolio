'use client';

import {
  EntityBadge,
  EntityNotice,
} from '@/components/shared/display/EntityPrimitives';
import { useOrderTask } from '@/hooks/useOrderTask';
import { Button } from '@/components/ui/Button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/Sheet';
import { Checkbox } from '@/components/ui/Checkbox';
import { OrderModalStepHeader } from '@/components/orders/shared/OrderModalStepHeader';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { cn } from '@/lib/utils';
import { Loader2, Lock, ChevronLeft, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import type { OrderStatus } from '@prisma/client';

/**
 * Maps each task type to the canonical order status it lives in.
 * Drives the step context header shown in the modal.
 */
const TASK_TYPE_TO_STATUS: Record<string, OrderStatus> = {
  CALL_BACK:        'RECEIVED',
  STOCK_RECEIPT:    'PROCESSING',
  INSTALL_REMINDER: 'READY',
  DELIVERY:         'IN_TRANSIT',
  INSTALLATION:     'INSTALLATION',
  INVOICE:          'COMPLETED',
  OTHER:            'PROCESSING',
};

const TASK_TYPE_DESCRIPTION: Record<string, string> = {
  CALL_BACK:        'שלב קבלת ההזמנה – יצירת קשר עם הלקוח',
  STOCK_RECEIPT:    'שלב הכנה – קליטת מלאי ורכש',
  INSTALL_REMINDER: 'שלב תיאום – קביעת מועד התקנה',
  DELIVERY:         'שלב משלוח – פעולות בדרך ללקוח',
  INSTALLATION:     'שלב התקנה – ביצוע ההתקנה בשטח',
  INVOICE:          'שלב סיום – חשבוניות ותשלומים',
  OTHER:            'פעולה שוטפת בהזמנה',
};

interface ChecklistActionModalProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
  /** Current order status – used to derive step context when task type is unknown */
  orderStatus?: string;
}

export function ChecklistActionModal({
  orderId,
  open,
  onOpenChange,
  onCompleted,
  orderStatus,
}: ChecklistActionModalProps) {
  const { task, isLoading, isUpdating, updateChecklist, completeTask } = useOrderTask(orderId);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const { toast } = useToast();

  const checklist = task?.checklist || [];
  const missingRequired = checklist.filter((item: any) => item.required && !item.checked);
  const isBlocked = missingRequired.length > 0;

  const taskType = task?.type ?? '';
  const stepStatus: OrderStatus =
    TASK_TYPE_TO_STATUS[taskType] ??
    (orderStatus ? normalizeOrderStatus(orderStatus) : 'PROCESSING');
  const stepDescription = TASK_TYPE_DESCRIPTION[taskType] ?? '';

  const completedCount = checklist.filter((item: any) => item.checked).length;
  const totalCount = checklist.length;

  const handleComplete = async () => {
    const result = await completeTask({
      override: overrideMode ? { enabled: true, reason: overrideReason } : undefined,
    });

    if (result?.success) {
      toast({ title: 'שלב הושלם בהצלחה', variant: 'success' });
      onCompleted?.();
      onOpenChange(false);
    } else if (result?.blocked) {
      toast({
        title: 'לא ניתן להשלים',
        description: `חסרים פריטים: ${result.missingItems?.join(', ')}`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'שגיאה',
        description: result?.error || 'אירעה שגיאה בביצוע הפעולה',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-xl sm:max-w-md mx-auto flex flex-col"
        dir="rtl"
      >
        <SheetHeader className="text-right shrink-0">
          <SheetTitle>
            {task ? `צ'קליסט: ${task.title}` : 'טוען משימה...'}
          </SheetTitle>
          <SheetDescription>
            יש להשלים את המשימות הבאות לפני המעבר לשלב הבא.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step context header */}
          {!isLoading && task && (
            <OrderModalStepHeader
              currentStatus={stepStatus}
              description={stepDescription}
              className="mb-4"
            />
          )}

          {/* Progress summary */}
          {!isLoading && totalCount > 0 && (
            <div className="flex items-center justify-between mb-3 px-1 text-xs text-slate-500">
              <span>
                הושלמו {completedCount} מתוך {totalCount} משימות
              </span>
              <span className="font-semibold text-slate-700">
                {Math.round((completedCount / totalCount) * 100)}%
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-3 pb-20">
              {checklist.map((item: any) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    item.checked
                      ? 'border-emerald-100 bg-emerald-50/70'
                      : 'bg-white border-slate-100'
                  )}
                >
                  <Checkbox
                    id={item.id}
                    checked={item.checked}
                    disabled={item.kind === 'data' || isUpdating}
                    onCheckedChange={(checked) => {
                      updateChecklist([{ itemId: item.id, checked: !!checked }]);
                    }}
                  />
                  <label
                    htmlFor={item.id}
                    className={cn(
                      'text-sm font-medium cursor-pointer flex-1 select-none',
                      item.checked ? 'text-green-700' : 'text-slate-700',
                      item.kind === 'data' && 'cursor-default'
                    )}
                  >
                    {item.label}
                    {item.required && <span className="text-red-500 mr-1">*</span>}
                  </label>
                  {item.kind === 'data' && (
                    <EntityBadge label="אוטומטי" tone="info" size="sm" />
                  )}
                </div>
              ))}

              {/* Override UI */}
              {isBlocked && !overrideMode && (
                <button
                  onClick={() => setOverrideMode(true)}
                  className="mt-6 flex w-full items-center justify-center gap-1 text-xs font-bold text-primary-600 hover:underline"
                >
                  <Lock className="h-3 w-3" />
                  המשך בכל זאת (נדרש אישור מנהל)
                </button>
              )}

              {overrideMode && (
                <EntityNotice
                  title="מעקף שלב"
                  description="הזן סיבה כדי להמשיך בחריגה מהתהליך."
                  tone="info"
                  className="mt-6 animate-in fade-in slide-in-from-bottom-2"
                >
                  <textarea
                    className="w-full rounded-md border border-[#d7e9ff] bg-white p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    rows={3}
                    placeholder="למה מדלגים על השלב?"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                  <button
                    onClick={() => setOverrideMode(false)}
                    className="w-full text-left text-[10px] font-bold text-primary-600 hover:underline"
                  >
                    ביטול מעקף
                  </button>
                </EntityNotice>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 pt-4 border-t border-slate-100 bg-white pb-6 sm:pb-0">
          {isBlocked && !overrideMode && !isLoading && (
            <EntityNotice
              icon={AlertCircle}
              title="חסר כדי להמשיך"
              description={missingRequired.map((i: any) => i.label).join(', ')}
              tone="warning"
              className="mb-3 w-full rounded-lg px-3 py-2"
            />
          )}
          <Button
            className="w-full h-12 text-base font-bold gap-2"
            disabled={
              isLoading ||
              isUpdating ||
              (isBlocked && !overrideMode) ||
              (overrideMode && !overrideReason)
            }
            onClick={handleComplete}
          >
            {isUpdating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
            {overrideMode ? 'אישור וחריגה מהשלב' : 'סיום שלב'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

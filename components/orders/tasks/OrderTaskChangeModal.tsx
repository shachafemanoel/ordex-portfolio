'use client';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/apiClient';
import { Loader2, Phone, Package, Bell, ListTodo } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export interface TaskTypeOption {
  value: string;
  labelHe: string;
  descriptionHe: string;
  icon: React.ReactNode;
}

const TASK_TYPE_OPTIONS: TaskTypeOption[] = [
  {
    value: 'CALL_BACK',
    labelHe: 'חזרה ללקוח',
    descriptionHe: 'צריך להתקשר ללקוח לעדכון, תיאום או מענה לשאלה',
    icon: <Phone className="w-5 h-5" />,
  },
  {
    value: 'STOCK_RECEIPT',
    labelHe: 'קליטת מלאי',
    descriptionHe: 'יש להכין ולקלוט את הסחורה בהזמנה למחסן',
    icon: <Package className="w-5 h-5" />,
  },
  {
    value: 'INSTALL_REMINDER',
    labelHe: 'תזכורת התקנה',
    descriptionHe: 'יש לתאם מועד התקנה עם הלקוח',
    icon: <Bell className="w-5 h-5" />,
  },
  {
    value: 'OTHER',
    labelHe: 'משימה כללית',
    descriptionHe: 'משימה חופשית שאינה שייכת לקטגוריה מסוימת',
    icon: <ListTodo className="w-5 h-5" />,
  },
];

const TYPE_STYLES: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  CALL_BACK: {
    border: 'border-primary-200',
    bg: 'bg-primary-50',
    text: 'text-brand-deep',
    dot: 'bg-primary-600',
  },
  STOCK_RECEIPT: {
    border: 'border-[var(--color-success-200)]',
    bg: 'bg-[var(--color-success-50)]',
    text: 'text-[var(--color-success-700)]',
    dot: 'bg-[var(--color-success-600)]',
  },
  INSTALL_REMINDER: {
    border: 'border-[var(--color-primary-300)]',
    bg: 'bg-primary-50',
    text: 'text-[var(--color-primary-800)]',
    dot: 'bg-[var(--color-primary-800)]',
  },
  OTHER: {
    border: 'border-subtle',
    bg: 'bg-surface-muted',
    text: 'text-fg-muted',
    dot: 'bg-[var(--color-neutral-500)]',
  },
};

interface OrderTaskChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  currentType?: string;
  onChanged?: () => void;
}

export function OrderTaskChangeModal({
  open,
  onOpenChange,
  orderId,
  currentType,
  onChanged,
}: OrderTaskChangeModalProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>(currentType ?? 'CALL_BACK');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      const res = await apiClient(`/api/orders/${orderId}/tasks/active/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newType: selectedType, reason: reason.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'שגיאה בשינוי סוג משימה');
      }

      toast({ title: 'סוג משימה עודכן בהצלחה', variant: 'default' });
      setReason('');
      onOpenChange(false);
      onChanged?.();
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: error instanceof Error ? error.message : 'נסו שוב',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>שינוי סוג משימה</DialogTitle>
          <DialogDescription>
            בחר את סוג המשימה הנדרש עבור ההזמנה. המשימה הקיימת תבוטל ותיפתח חדשה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {TASK_TYPE_OPTIONS.map((option) => {
            const isSelected = selectedType === option.value;
            const style = TYPE_STYLES[option.value] ?? TYPE_STYLES.OTHER;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedType(option.value)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all',
                  isSelected
                    ? `${style.border} ${style.bg}`
                    : 'border-subtle bg-surface hover:border-primary-200 hover:bg-surface-muted'
                )}
              >
                <div
                  className={cn(
                    'p-2 rounded-lg shrink-0',
                    isSelected ? style.bg : 'bg-surface-highlight',
                    isSelected ? style.text : 'text-fg-muted'
                  )}
                >
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-semibold text-sm',
                      isSelected ? style.text : 'text-fg'
                    )}
                  >
                    {option.labelHe}
                    {option.value === currentType && (
                      <span className="mr-2 text-[10px] bg-neutral-mute text-fg-muted px-1.5 py-0.5 rounded-full font-normal">
                        נוכחי
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-fg-muted mt-0.5 leading-snug">
                    {option.descriptionHe}
                  </p>
                </div>
                {isSelected && (
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      style.border,
                      style.bg
                    )}
                  >
                    <div className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Reason field */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-fg-muted">
            סיבה לשינוי (אופציונלי)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="לדוגמה: הלקוח ביקש לתאם התקנה"
            className="w-full text-sm p-2.5 border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] resize-none bg-surface"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            ביטול
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedType || selectedType === currentType}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            עדכן משימה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

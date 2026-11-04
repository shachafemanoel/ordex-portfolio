import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { OrderModalStepHeader } from '@/components/orders/shared/OrderModalStepHeader';
import { Order } from '@/lib/types';
import { normalizeOrderStatus } from '@/lib/orderStatus';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Order;
  onConfirm: (payload: any) => Promise<void>;
  title?: string;
  description?: string;
}

export function PaymentModal({ isOpen, onClose, entity, onConfirm, title, description }: PaymentModalProps) {
  const [method, setMethod] = useState('CREDIT_CARD');
  const [status, setStatus] = useState('PAID');
  const remainingCents = Math.max(0, (entity.totalCents || 0) - (entity.paidAmountCents || 0));
  const [amount, setAmount] = useState((remainingCents / 100).toString());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        method,
        status,
        amountCents: Math.round(parseFloat(amount) * 100),
        reference,
        notes,
      };
      await onConfirm(payload);
      onClose();
    } catch (e) {
      // Error handled by runner
    } finally {
      setIsSubmitting(false);
    }
  };

  // Payment is part of the COMPLETED / INVOICED step
  const currentStatus = entity.status
    ? normalizeOrderStatus(String(entity.status))
    : 'COMPLETED';

  const methods = [
    { value: 'CREDIT_CARD', label: 'כרטיס אשראי' },
    { value: 'BANK_TRANSFER', label: 'העברה בנקאית' },
    { value: 'CASH', label: 'מזומן' },
    { value: 'CHECK', label: "צ'ק" },
    { value: 'BIT', label: 'ביט' },
    { value: 'PAYPAL', label: 'PayPal' },
    { value: 'OTHER', label: 'אחר' },
  ];

  const statuses = [
    { value: 'PAID', label: 'שולם' },
    { value: 'PENDING', label: 'ממתין' },
    { value: 'AUTHORIZED', label: 'אושר (תפיסת מסגרת)' },
    { value: 'PARTIAL', label: 'חלקית' },
  ];

  const remainingFormatted = (remainingCents / 100).toLocaleString('he-IL', {
    style: 'currency',
    currency: entity.currency || 'ILS',
    maximumFractionDigits: 0,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'עדכון תשלום'} maxWidth="md">
      <div className="space-y-4" dir="rtl">
        {/* Step context – payment is part of the COMPLETED stage */}
        <OrderModalStepHeader
          currentStatus={currentStatus}
          description="רישום תשלום מעדכן את יתרת החוב ומתעד את האמצעי שבו שולם"
        />

        {description && <p className="text-gray-500 text-sm">{description}</p>}

        {/* Remaining balance indicator */}
        {remainingCents > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800 flex items-center justify-between">
            <span>יתרת חוב:</span>
            <span className="font-bold">{remainingFormatted}</span>
          </div>
        )}

        {/* Responsive form grid */}
        <div className="form-grid">
          <div>
            <label className="block text-sm font-medium mb-1.5">אמצעי תשלום</label>
            <Select options={methods} value={method} onValueChange={setMethod} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">סטטוס</label>
            <Select options={statuses} value={status} onValueChange={setStatus} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">סכום</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">אסמכתא</label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="מספר אישור / צ'ק"
            />
          </div>

          <div className="form-grid-full">
            <label className="block text-sm font-medium mb-1.5">הערות</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות לתשלום" />
          </div>
        </div>

        {/* Footer – full-width stacked on mobile */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} size="lg" className="w-full sm:w-auto sm:h-10">
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="w-full sm:w-auto sm:h-10">
            שמור תשלום
          </Button>
        </div>
      </div>
    </Modal>
  );
}

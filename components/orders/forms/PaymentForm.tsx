/**
 * PaymentForm Component
 *
 * Standalone payment form component with full Prisma schema support.
 * Handles payment creation with automatic balance calculation.
 *
 * Features:
 * - Complete Prisma Payment schema field coverage
 * - Payment method selection
 * - Payment status tracking
 * - Automatic balance calculation
 * - Reference/check number support
 * - RTL support
 * - Form validation with Zod
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { tokens } from '@/lib/design-tokens';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import type { PaymentStatus, PaymentMethod } from '@prisma/client';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

/**
 * Payment validation schema matching Prisma Payment model
 */
const paymentSchema = z.object({
  // Required fields
  method: z.string().min(1, 'שיטת תשלום היא שדה חובה'),
  status: z.enum(['PENDING', 'AUTHORIZED', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED'], {
    required_error: 'סטטוס תשלום הוא שדה חובה',
  }),
  amountCents: z
    .number()
    .int('חייב להיות מספר שלם')
    .min(1, 'סכום התשלום חייב להיות גדול מ-0'),

  // Optional fields
  reference: z.string().max(100, 'מספר אסמכתא ארוך מדי').optional().or(z.literal('')),
  notes: z.string().max(5000, 'הערות ארוכות מדי').optional().or(z.literal('')),
  externalId: z.string().optional().or(z.literal('')),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface PaymentFormProps {
  /** Order ID */
  orderId: string;

  /** Order total in cents */
  orderTotalCents: number;

  /** Already paid amount in cents */
  paidAmountCents?: number;

  /** Submit handler */
  onSubmit: (data: PaymentFormData) => Promise<void>;

  /** Cancel handler */
  onCancel?: () => void;

  /** Is submitting */
  isSubmitting?: boolean;

  /** Currency symbol */
  currency?: string;

  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// PAYMENT METHODS
// ============================================================================

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'מזומן' },
  { value: 'CREDIT_CARD', label: 'כרטיס אשראי' },
  { value: 'DEBIT_CARD', label: 'כרטיס חיוב' },
  { value: 'CHECK', label: 'צ\'ק' },
  { value: 'BANK_TRANSFER', label: 'העברה בנקאית' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'BIT', label: 'Bit' },
  { value: 'OTHER', label: 'אחר' },
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert cents to currency for display
 */
function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Convert currency display to cents
 */
function displayToCents(display: string): number {
  const num = parseFloat(display);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PaymentForm - Payment creation form with balance tracking
 *
 * @example
 * ```tsx
 * <PaymentForm
 *   orderId="order-123"
 *   orderTotalCents={100000}
 *   paidAmountCents={50000}
 *   onSubmit={async (data) => {
 *     await createPayment(orderId, data);
 *   }}
 *   currency="₪"
 * />
 * ```
 */
export const PaymentForm: React.FC<PaymentFormProps> = ({
  orderId,
  orderTotalCents,
  paidAmountCents = 0,
  onSubmit,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
  currency = '₪',
  className,
}) => {
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const isSubmitting = externalIsSubmitting || internalIsSubmitting;

  const outstandingBalance = orderTotalCents - paidAmountCents;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'CASH',
      status: 'PAID',
      amountCents: outstandingBalance > 0 ? outstandingBalance : 0,
      reference: '',
      notes: '',
      externalId: '',
    },
  });

  const watchedAmount = watch('amountCents');
  const watchedMethod = watch('method');

  // Calculate new balance after payment
  const newBalance = outstandingBalance - (watchedAmount || 0);
  const isFullPayment = newBalance === 0;
  const isPartialPayment = newBalance > 0 && watchedAmount > 0;
  const isOverpayment = newBalance < 0;

  // Auto-suggest status based on amount
  useEffect(() => {
    if (isFullPayment) {
      setValue('status', 'PAID');
    } else if (isPartialPayment) {
      setValue('status', 'PARTIAL');
    }
  }, [isFullPayment, isPartialPayment, setValue]);

  const handleFormSubmit = async (data: PaymentFormData) => {
    try {
      setInternalIsSubmitting(true);
      await onSubmit(data);
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  const handleQuickAmount = (percentage: number) => {
    const amount = Math.round(outstandingBalance * percentage);
    setValue('amountCents', amount);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn('space-y-6', className)}
      dir="rtl"
    >
      {/* Payment Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">סה״כ הזמנה:</span>
          <span className="font-medium" dir="ltr">
            {currency}
            {centsToDisplay(orderTotalCents)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">שולם עד כה:</span>
          <span className="font-medium" dir="ltr">
            {currency}
            {centsToDisplay(paidAmountCents)}
          </span>
        </div>
        <div className="flex justify-between text-lg font-semibold border-t border-blue-300 pt-2">
          <span>יתרה לתשלום:</span>
          <span
            className={cn(outstandingBalance > 0 ? 'text-orange-600' : 'text-green-600')}
            dir="ltr"
          >
            {currency}
            {centsToDisplay(outstandingBalance)}
          </span>
        </div>
      </div>

      {/* Payment Method */}
      <FormField label="שיטת תשלום" required error={errors.method?.message}>
        <Select {...register('method')} disabled={isSubmitting}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </Select>
      </FormField>

      {/* Payment Amount */}
      <div className="space-y-3">
        <FormField label={`סכום (${currency})`} required error={errors.amountCents?.message}>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={centsToDisplay(watchedAmount || 0)}
            onChange={(e) => setValue('amountCents', displayToCents(e.target.value))}
            disabled={isSubmitting}
            dir="ltr"
          />
        </FormField>

        {/* Quick Amount Buttons */}
        {outstandingBalance > 0 && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickAmount(0.25)}
              disabled={isSubmitting}
            >
              25%
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickAmount(0.5)}
              disabled={isSubmitting}
            >
              50%
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickAmount(0.75)}
              disabled={isSubmitting}
            >
              75%
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickAmount(1)}
              disabled={isSubmitting}
            >
              מלא
            </Button>
          </div>
        )}

        {/* Balance Preview */}
        {watchedAmount > 0 && (
          <div
            className={cn(
              'p-3 rounded-lg border text-sm',
              isFullPayment && 'bg-green-50 border-green-200',
              isPartialPayment && 'bg-yellow-50 border-yellow-200',
              isOverpayment && 'bg-red-50 border-red-200'
            )}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">
                {isFullPayment && '✅ תשלום מלא'}
                {isPartialPayment && '⚠️ תשלום חלקי'}
                {isOverpayment && '❌ תשלום יתר'}
              </span>
              <span className="font-semibold" dir="ltr">
                יתרה חדשה: {currency}
                {centsToDisplay(Math.abs(newBalance))}
                {isOverpayment && ' (זכות)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Payment Status */}
      <FormField label="סטטוס תשלום" required error={errors.status?.message}>
        <Select {...register('status')} disabled={isSubmitting}>
          <option value="PENDING">ממתין</option>
          <option value="AUTHORIZED">מאושר</option>
          <option value="PAID">שולם</option>
          <option value="PARTIAL">חלקי</option>
          <option value="FAILED">נכשל</option>
          <option value="REFUNDED">הוחזר</option>
        </Select>
      </FormField>

      {/* Reference Number (for checks, transfers, etc.) */}
      {(watchedMethod === 'check' || watchedMethod === 'bank_transfer') && (
        <FormField
          label={watchedMethod === 'check' ? 'מספר צ\'ק' : 'מספר העברה'}
          error={errors.reference?.message}
        >
          <Input
            {...register('reference')}
            placeholder={
              watchedMethod === 'check' ? 'מספר הצ\'ק' : 'מספר אסמכתא/העברה'
            }
            disabled={isSubmitting}
          />
        </FormField>
      )}

      {/* Notes */}
      <FormField label="הערות" error={errors.notes?.message}>
        <Textarea
          {...register('notes')}
          rows={3}
          placeholder="הערות נוספות על התשלום..."
          disabled={isSubmitting}
        />
      </FormField>

      {/* Form Actions */}
      <div className={cn(tokens.layout.flexBetween, 'gap-3', 'pt-4', 'border-t')}>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            ביטול
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="ms-auto">
          {isSubmitting ? 'שומר...' : 'רשום תשלום'}
        </Button>
      </div>
    </form>
  );
};

export default PaymentForm;

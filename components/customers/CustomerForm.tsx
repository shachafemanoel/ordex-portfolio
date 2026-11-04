/**
 * CustomerForm Component
 *
 * Standalone customer form component with full Prisma schema support.
 * Includes ALL fields from the Customer model, including those often missing
 * from quick-create forms.
 *
 * Features:
 * - Complete Prisma schema field coverage
 * - Create and edit modes
 * - RTL support
 * - Form validation with Zod
 * - Responsive layout
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { tokens } from '@/lib/design-tokens';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Section } from '@/components/layout/Section';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

/**
 * Customer validation schema matching Prisma Customer model
 */
const customerSchema = z.object({
  // Basic Information (required)
  name: z.string().min(1, 'שם הלקוח הוא שדה חובה').max(255, 'שם ארוך מדי'),

  // Contact Information (optional)
  email: z
    .string()
    .email('כתובת אימייל לא תקינה')
    .max(320, 'כתובת אימייל ארוכה מדי')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^[0-9\-\+\(\)\s]*$/, 'מספר טלפון לא תקין')
    .max(64, 'מספר טלפון ארוך מדי')
    .optional()
    .or(z.literal('')),

  // Financial Fields (often missing!)
  creditLimitCents: z
    .number()
    .int('חייב להיות מספר שלם')
    .min(0, 'מסגרת אשראי לא יכולה להיות שלילית')
    .optional()
    .nullable(),
  paymentTermsDays: z
    .number()
    .int('חייב להיות מספר שלם')
    .min(0, 'תקופת תשלום לא יכולה להיות שלילית')
    .max(365, 'תקופת תשלום ארוכה מדי')
    .optional()
    .nullable(),

  // Account Notes (often missing!)
  accountNotes: z.string().max(5000, 'הערות ארוכות מדי').optional().or(z.literal('')),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface CustomerFormProps {
  /** Form mode */
  mode?: 'create' | 'edit';

  /** Initial values (for edit mode) */
  initialValues?: Partial<CustomerFormData>;

  /** Submit handler */
  onSubmit: (data: CustomerFormData) => Promise<void>;

  /** Cancel handler */
  onCancel?: () => void;

  /** Is submitting */
  isSubmitting?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert cents to currency for display
 */
function centsToDisplay(cents?: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

/**
 * Convert currency display to cents
 */
function displayToCents(display: string): number | null {
  if (!display || display.trim() === '') return null;
  const num = parseFloat(display);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CustomerForm - Complete customer creation/editing form
 *
 * @example
 * ```tsx
 * // Create mode
 * <CustomerForm
 *   mode="create"
 *   onSubmit={async (data) => {
 *     await createCustomer(data);
 *   }}
 *   onCancel={() => router.back()}
 * />
 *
 * // Edit mode
 * <CustomerForm
 *   mode="edit"
 *   initialValues={customer}
 *   onSubmit={async (data) => {
 *     await updateCustomer(customerId, data);
 *   }}
 * />
 * ```
 */
export const CustomerForm: React.FC<CustomerFormProps> = ({
  mode = 'create',
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
  className,
}) => {
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const isSubmitting = externalIsSubmitting || internalIsSubmitting;

  // Credit limit display values
  const [creditLimitDisplay, setCreditLimitDisplay] = useState(
    centsToDisplay(initialValues?.creditLimitCents)
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: initialValues?.name || '',
      email: initialValues?.email || '',
      phone: initialValues?.phone || '',
      creditLimitCents: initialValues?.creditLimitCents || null,
      paymentTermsDays: initialValues?.paymentTermsDays || null,
      accountNotes: initialValues?.accountNotes || '',
    },
  });

  const handleFormSubmit = async (data: CustomerFormData) => {
    try {
      setInternalIsSubmitting(true);
      await onSubmit(data);
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  const handleCreditLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCreditLimitDisplay(value);
    const cents = displayToCents(value);
    setValue('creditLimitCents', cents);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn('space-y-6', className)}
      dir="rtl"
    >
      {/* Basic Information Section */}
      <Section title="מידע בסיסי" variant="bordered" spacing="lg">
        <div className="space-y-4">
          {/* Name - Required */}
          <FormField label="שם הלקוח" required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder="שם מלא"
              disabled={isSubmitting}
              autoFocus={mode === 'create'}
            />
          </FormField>

          {/* Email - Optional */}
          <FormField label="דוא״ל" error={errors.email?.message}>
            <Input
              {...register('email')}
              type="email"
              placeholder="example@domain.com"
              disabled={isSubmitting}
              dir="ltr"
            />
          </FormField>

          {/* Phone - Optional */}
          <FormField label="טלפון" error={errors.phone?.message}>
            <Input
              {...register('phone')}
              type="tel"
              placeholder="050-1234567"
              disabled={isSubmitting}
              dir="ltr"
            />
          </FormField>
        </div>
      </Section>

      {/* Financial Information Section */}
      <Section
        title="מידע פיננסי"
        description="מסגרת אשראי ותנאי תשלום"
        variant="bordered"
        spacing="lg"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Credit Limit - Often Missing! */}
          <FormField
            label="מסגרת אשראי (₪)"
            error={errors.creditLimitCents?.message}
            description="המסגרת המקסימלית שהלקוח יכול לקנות באשראי"
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={creditLimitDisplay}
              onChange={handleCreditLimitChange}
              placeholder="0.00"
              disabled={isSubmitting}
              dir="ltr"
            />
          </FormField>

          {/* Payment Terms - Often Missing! */}
          <FormField
            label="תנאי תשלום (ימים)"
            error={errors.paymentTermsDays?.message}
            description="מספר הימים עד לתשלום (למשל 30+)"
          >
            <Input
              {...register('paymentTermsDays', { valueAsNumber: true })}
              type="number"
              min="0"
              max="365"
              placeholder="30"
              disabled={isSubmitting}
            />
          </FormField>
        </div>
      </Section>

      {/* Account Notes Section */}
      <Section
        title="הערות חשבון"
        description="הערות פנימיות על הלקוח"
        variant="bordered"
        spacing="lg"
      >
        {/* Account Notes - Often Missing! */}
        <FormField label="הערות" error={errors.accountNotes?.message}>
          <Textarea
            {...register('accountNotes')}
            rows={4}
            placeholder="הערות פנימיות על החשבון..."
            disabled={isSubmitting}
          />
        </FormField>
      </Section>

      {/* Form Actions */}
      <div className={cn(tokens.layout.flexBetween, 'gap-3', 'pt-4', 'border-t')}>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            ביטול
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="ms-auto">
          {isSubmitting ? 'שומר...' : mode === 'create' ? 'צור לקוח' : 'עדכן לקוח'}
        </Button>
      </div>
    </form>
  );
};

export default CustomerForm;

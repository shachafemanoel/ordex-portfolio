/**
 * AddressForm Component
 *
 * Standalone address form component with full Prisma schema support.
 * Includes ALL fields from the Address model with geocoding support.
 *
 * Features:
 * - Complete Prisma Address schema field coverage
 * - Address type selection (BILLING/SHIPPING)
 * - Automatic geocoding (lat/lng)
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
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import type { AddressType } from '@prisma/client';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

/**
 * Address validation schema matching Prisma Address model
 */
const addressSchema = z.object({
  // Required fields
  type: z.enum(['BILLING', 'SHIPPING'], {
    required_error: 'סוג כתובת הוא שדה חובה',
  }),
  city: z.string().min(1, 'עיר היא שדה חובה').max(120, 'שם העיר ארוך מדי'),
  street: z.string().min(1, 'רחוב הוא שדה חובה').max(180, 'שם הרחוב ארוך מדי'),
  number: z.string().min(1, 'מספר בית הוא שדה חובה').max(50, 'מספר הבית ארוך מדי'),

  // Optional fields
  floor: z.string().max(20, 'קומה ארוכה מדי').optional().or(z.literal('')),
  notes: z.string().max(500, 'הערות ארוכות מדי').optional().or(z.literal('')),

  // Geocoding fields (auto-populated)
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

export type AddressFormData = z.infer<typeof addressSchema>;

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface AddressFormProps {
  /** Form mode */
  mode?: 'create' | 'edit';

  /** Initial values (for edit mode) */
  initialValues?: Partial<AddressFormData>;

  /** Submit handler */
  onSubmit: (data: AddressFormData) => Promise<void>;

  /** Cancel handler */
  onCancel?: () => void;

  /** Is submitting */
  isSubmitting?: boolean;

  /** Enable geocoding */
  enableGeocoding?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AddressForm - Complete address creation/editing form
 *
 * @example
 * ```tsx
 * // Create mode
 * <AddressForm
 *   mode="create"
 *   onSubmit={async (data) => {
 *     await createAddress(customerId, data);
 *   }}
 *   enableGeocoding
 * />
 *
 * // Edit mode
 * <AddressForm
 *   mode="edit"
 *   initialValues={address}
 *   onSubmit={async (data) => {
 *     await updateAddress(addressId, data);
 *   }}
 * />
 * ```
 */
export const AddressForm: React.FC<AddressFormProps> = ({
  mode = 'create',
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
  enableGeocoding = true,
  className,
}) => {
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const isSubmitting = externalIsSubmitting || internalIsSubmitting;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      type: initialValues?.type || 'SHIPPING',
      city: initialValues?.city || '',
      street: initialValues?.street || '',
      number: initialValues?.number || '',
      floor: initialValues?.floor || '',
      notes: initialValues?.notes || '',
      lat: initialValues?.lat || null,
      lng: initialValues?.lng || null,
    },
  });

  // Watch address fields for geocoding
  const city = watch('city');
  const street = watch('street');
  const number = watch('number');

  const handleFormSubmit = async (data: AddressFormData) => {
    try {
      setInternalIsSubmitting(true);
      await onSubmit(data);
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn('space-y-6', className)}
      dir="rtl"
    >
      {/* Address Type */}
      <FormField label="סוג כתובת" required error={errors.type?.message}>
        <Select {...register('type')} disabled={isSubmitting}>
          <option value="SHIPPING">כתובת משלוח</option>
          <option value="BILLING">כתובת לחיוב</option>
        </Select>
      </FormField>

      {/* Google Autocomplete */}
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
        <Label className="text-xs font-bold text-blue-700 mb-2 block">חיפוש כתובת בגוגל</Label>
        <PlacesAutocomplete
          onAddressSelect={(addr) => {
            setValue('city', addr.city, { shouldValidate: true });
            setValue('street', addr.street, { shouldValidate: true });
            setValue('number', addr.streetNumber, { shouldValidate: true });
            if (addr.lat && addr.lng) {
              setValue('lat', addr.lat);
              setValue('lng', addr.lng);
            }
          }}
          className="bg-white"
        />
      </div>

      {/* Address Fields */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* City - Required */}
        <FormField label="עיר" required error={errors.city?.message}>
          <Input
            {...register('city')}
            placeholder="תל אביב"
            disabled={isSubmitting}
            autoFocus={mode === 'create'}
          />
        </FormField>

        {/* Street - Required */}
        <FormField label="רחוב" required error={errors.street?.message}>
          <Input
            {...register('street')}
            placeholder="דיזנגוף"
            disabled={isSubmitting}
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Number - Required */}
        <FormField label="מספר בית" required error={errors.number?.message}>
          <Input
            {...register('number')}
            placeholder="50"
            disabled={isSubmitting}
          />
        </FormField>

        {/* Floor - Optional */}
        <FormField label="קומה" error={errors.floor?.message}>
          <Input
            {...register('floor')}
            placeholder="3"
            disabled={isSubmitting}
          />
        </FormField>
      </div>

      {/* Notes - Optional */}
      <FormField label="הערות" error={errors.notes?.message}>
        <Textarea
          {...register('notes')}
          rows={3}
          placeholder="הנחיות הגעה, מידע נוסף..."
          disabled={isSubmitting}
        />
      </FormField>

      {/* Coordinates (hidden, for debugging) */}
      {enableGeocoding && (watch('lat') || watch('lng')) && (
        <div className="text-xs text-gray-500 border-t pt-3">
          <span className="font-medium">קואורדינטות:</span>{' '}
          {watch('lat')?.toFixed(6)}, {watch('lng')?.toFixed(6)}
        </div>
      )}

      {/* Form Actions */}
      <div className={cn(tokens.layout.flexBetween, 'gap-3', 'pt-4', 'border-t')}>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            ביטול
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="ms-auto">
          {isSubmitting ? 'שומר...' : mode === 'create' ? 'הוסף כתובת' : 'עדכן כתובת'}
        </Button>
      </div>
    </form>
  );
};

export default AddressForm;

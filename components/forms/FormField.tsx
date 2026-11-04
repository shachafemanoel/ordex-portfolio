'use client';

import { forwardRef, type Ref } from 'react';

import { Input, type InputProps } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, type SelectProps } from '@/components/ui/Select';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  helperText?: string;
  className?: string;
  id?: string;
  htmlType?: InputProps['type'];
}

interface FormInputFieldProps extends FormFieldProps, Omit<InputProps, 'error'> {
  type?: 'input';
}

interface FormSelectFieldProps extends FormFieldProps, Omit<SelectProps, 'error'> {
  type: 'select';
}

type CombinedFormFieldProps = FormInputFieldProps | FormSelectFieldProps;

export const FormField = forwardRef<HTMLInputElement | HTMLSelectElement, CombinedFormFieldProps>(
  (
    {
      label,
      error,
      required = false,
      helperText,
      className = '',
      id,
      type = 'input',
      htmlType,
      ...props
    },
    forwardedRef
  ) => {
    const fieldId = id || `field-${label.toLowerCase().replace(/[^a-z0-9א-ת]+/giu, '-')}`;
    const hasError = Boolean(error);
    const helperId = helperText ? `${fieldId}-helper` : undefined;
    const errorId = hasError ? `${fieldId}-error` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`space-y-1 ${className}`}>
        <Label
          htmlFor={fieldId}
          className="text-right font-hebrew block text-sm font-medium text-gray-700"
        >
          {label}
          {required && (
            <span className="ml-1 text-red-500" aria-hidden="true">
              *
            </span>
          )}
          {required && (
            <span className="sr-only">שדה חובה</span>
          )}
        </Label>

        {type === 'select' ? (
          <Select
            {...(props as SelectProps)}
            id={fieldId}
            error={hasError}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            className={`text-right ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
            ref={forwardedRef as Ref<HTMLSelectElement>}
          />
        ) : (
          <Input
            {...(props as InputProps)}
            id={fieldId}
            error={hasError}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            type={htmlType}
            className={`text-right ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
            ref={forwardedRef as Ref<HTMLInputElement>}
          />
        )}

        {error && (
          <p id={errorId} className="text-sm text-red-600 text-right font-hebrew" role="alert">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-500 text-right font-hebrew">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

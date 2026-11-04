import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import React, { Children, cloneElement, isValidElement, useId } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  description,
  children,
  className,
}) => {
  const generatedId = useId();
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;

  // We'll track the ID of the input to ensure the label points to it correctly
  let inputId = generatedId;

  const childrenWithProps = Children.map(children, (child) => {
    if (isValidElement(child)) {
      // If the child already has an id, we'll use that for the label
      // Note: If multiple children have IDs, the last one wins for the label.
      // This is a known limitation for a component that expects a single input.
      const childProps = child.props as { id?: string; 'aria-describedby'?: string };

      if (childProps.id) {
        inputId = childProps.id;
      }

      const ariaDescribedBy = [
        description ? descriptionId : null,
        error ? errorId : null,
        childProps['aria-describedby']
      ].filter(Boolean).join(' ') || undefined;

      return cloneElement(child as React.ReactElement<any>, {
        id: childProps.id || generatedId,
        'aria-describedby': ariaDescribedBy,
        'aria-invalid': error ? true : undefined,
      });
    }
    return child;
  });

  return (
    <div className={cn('space-y-2 md:space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={inputId}
          className={cn(
            'text-sm font-medium leading-none',
            // Touch: slightly larger label for readability
            'md:text-sm',
            error && 'text-red-500'
          )}
        >
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
      </div>
      {childrenWithProps}
      {description && (
        <p id={descriptionId} className="text-xs md:text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs md:text-sm font-medium text-red-500 flex items-center gap-1.5" role="alert">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};

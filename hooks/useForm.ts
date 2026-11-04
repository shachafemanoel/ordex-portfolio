import { useCallback, useState } from 'react';
import { z } from 'zod';

export interface UseFormOptions<T> {
  schema: z.AnyZodObject;
  initialValues?: Partial<T>;
  onSubmit?: (values: T) => Promise<void> | void;
}

export interface FormState<T> {
  values: Partial<T>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

export function useForm<T extends Record<string, any>>({
  schema,
  initialValues = {},
  onSubmit,
}: UseFormOptions<T>) {
  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: false,
  });

  const validateField = useCallback(
    (name: keyof T, value: any) => {
      try {
        // Validate single field
        const fieldSchema = schema.pick({ [name]: true } as any);
        fieldSchema.parse({ [name]: value });
        return null;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error.errors[0]?.message || `Invalid ${String(name)}`;
        }
        return 'Validation error';
      }
    },
    [schema]
  );

  const validateForm = useCallback(
    (values: Partial<T>) => {
      try {
        schema.parse(values);
        return {};
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error.errors.reduce(
            (acc, curr) => {
              const path = curr.path.join('.');
              acc[path] = curr.message;
              return acc;
            },
            {} as Record<string, string>
          );
        }
        return {};
      }
    },
    [schema]
  );

  const setValue = useCallback(
    (name: keyof T, value: any) => {
      setState((prev) => {
        const newValues = { ...prev.values, [name]: value };
        const fieldError = validateField(name, value);
        const newErrors = { ...prev.errors };

        if (fieldError) {
          newErrors[String(name)] = fieldError;
        } else {
          delete newErrors[String(name)];
        }

        const allErrors = validateForm(newValues);
        const isValid = Object.keys(allErrors).length === 0;

        return {
          ...prev,
          values: newValues,
          errors: prev.touched[String(name)] ? newErrors : prev.errors,
          isValid,
        };
      });
    },
    [validateField, validateForm]
  );

  const setTouched = useCallback(
    (name: keyof T, touched = true) => {
      setState((prev) => {
        const newTouched = { ...prev.touched, [String(name)]: touched };
        const fieldError = validateField(name, prev.values[name]);
        const newErrors = { ...prev.errors };

        if (touched && fieldError) {
          newErrors[String(name)] = fieldError;
        }

        return {
          ...prev,
          touched: newTouched,
          errors: newErrors,
        };
      });
    },
    [validateField]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!onSubmit) return;

      setState((prev) => ({ ...prev, isSubmitting: true }));

      try {
        // Mark all fields as touched
        const allTouched = Object.keys(state.values).reduce(
          (acc, key) => {
            acc[key] = true;
            return acc;
          },
          {} as Record<string, boolean>
        );

        // Validate entire form
        const errors = validateForm(state.values);

        setState((prev) => ({
          ...prev,
          touched: allTouched,
          errors,
        }));

        if (Object.keys(errors).length > 0) {
          throw new Error('Form validation failed');
        }

        const validatedValues = schema.parse(state.values) as T;
        await onSubmit(validatedValues);
      } catch (error) {
        console.error('Form submission error:', error);
        // Error handling can be extended here
      } finally {
        setState((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [schema, state.values, validateForm, onSubmit]
  );

  const reset = useCallback(
    (newValues?: Partial<T>) => {
      setState({
        values: newValues || initialValues,
        errors: {},
        touched: {},
        isSubmitting: false,
        isValid: false,
      });
    },
    [initialValues]
  );

  const getFieldProps = useCallback(
    (name: keyof T) => {
      const fieldError = state.touched[String(name)] && state.errors[String(name)];
      return {
        name: String(name),
        value: state.values[name] || '',
        ...(fieldError && { error: fieldError }),
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
          setValue(name, e.target.value);
        },
        onBlur: () => {
          setTouched(name, true);
        },
      };
    },
    [state.values, state.errors, state.touched, setValue, setTouched]
  );

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isSubmitting: state.isSubmitting,
    isValid: state.isValid,
    setValue,
    setTouched,
    handleSubmit,
    reset,
    getFieldProps,
  };
}

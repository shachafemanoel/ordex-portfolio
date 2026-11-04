import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FormField } from '@/components/ui/FormField';

// Mock Input component that forwards refs and props, similar to the real one
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} />
);
Input.displayName = 'Input';

describe('FormField', () => {
  it('associates label with input using auto-generated id', () => {
    render(
      <FormField label="Test Label">
        <Input />
      </FormField>
    );

    const label = screen.getByText('Test Label');
    const input = screen.getByRole('textbox'); // Input defaults to type="text" usually, or just check tag

    // The label should have an 'for' attribute
    const htmlFor = label.getAttribute('for');
    expect(htmlFor).toBeTruthy();

    // The input should have an 'id' matching 'for'
    expect(input.getAttribute('id')).toBe(htmlFor);
  });

  it('uses provided id if available', () => {
    render(
      <FormField label="Test Label">
        <Input id="custom-id" />
      </FormField>
    );

    const label = screen.getByText('Test Label');
    const input = screen.getByRole('textbox');

    expect(label.getAttribute('for')).toBe('custom-id');
    expect(input.getAttribute('id')).toBe('custom-id');
  });

  it('links error message via aria-describedby', () => {
    render(
      <FormField label="Test Label" error="Error message">
        <Input />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    const error = screen.getByText('Error message');

    expect(error.id).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('links description via aria-describedby', () => {
    render(
      <FormField label="Test Label" description="Helper text">
        <Input />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    const description = screen.getByText('Helper text');

    expect(description.id).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(description.id);
  });
});

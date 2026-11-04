import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import { SupplierForm, type SupplierFormValues } from '@/components/suppliers/SupplierForm';

const submitSpy = vi.fn<[], Promise<void>>(() => Promise.resolve());
const cancelSpy = vi.fn();

beforeEach(() => {
  submitSpy.mockClear();
  cancelSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('SupplierForm', () => {
  it('shows validation errors when required fields missing', async () => {
    render(
      <SupplierForm
        layout="plain"
        onSubmit={submitSpy as (values: SupplierFormValues) => Promise<void>}
        onCancel={cancelSpy}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'יצירת ספק' }));

    const errors = await screen.findAllByText('שם הספק הוא שדה חובה');
    expect(errors.length).toBeGreaterThan(0);
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('calls onSubmit with normalised values', async () => {
    const handler = vi.fn<[], Promise<void>>(() => Promise.resolve());

    render(
      <SupplierForm
        layout="plain"
        onSubmit={handler as (values: SupplierFormValues) => Promise<void>}
        onCancel={cancelSpy}
      />
    );

    fireEvent.change(screen.getByLabelText(/שם הספק/), { target: { value: ' ספק חדש ' } });
    fireEvent.change(screen.getByLabelText(/מספר עוסק\/ח.פ./), { target: { value: ' 123456789 ' } });
    fireEvent.change(screen.getByLabelText(/כתובת מלאה/), { target: { value: ' רחוב הבנאים 5, חיפה ' } });
    fireEvent.change(screen.getByLabelText(/אימייל/), { target: { value: ' supplier@example.com ' } });
    fireEvent.change(screen.getByLabelText(/טלפון/), { target: { value: ' 050-1234567 ' } });
    fireEvent.change(screen.getByLabelText(/תנאי תשלום/), { target: { value: '  שוטף + 30 ' } });

    fireEvent.click(screen.getByRole('button', { name: 'יצירת ספק' }));

    await waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
    });

    const payload = handler.mock.calls[0][0];
    expect(payload.name).toBe('ספק חדש');
    expect(payload.govId).toBe('123456789');
    expect(payload.address).toBe('רחוב הבנאים 5, חיפה');
    expect(payload.email).toBe('supplier@example.com');
    expect(payload.phone).toBe('050-1234567');
    expect(payload.paymentTerms).toBe('שוטף + 30');
  });

  it('triggers onCancel without validating', () => {
    render(
      <SupplierForm
        layout="plain"
        onSubmit={submitSpy as (values: SupplierFormValues) => Promise<void>}
        onCancel={cancelSpy}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByText('שם הספק הוא שדה חובה').length).toBe(0);
    expect(submitSpy).not.toHaveBeenCalled();
  });
});

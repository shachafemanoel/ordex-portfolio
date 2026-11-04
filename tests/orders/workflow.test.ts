import { describe, expect, it } from 'vitest';
import { validateTransition } from '@/lib/status-machine';
import { computeReceiptProgress } from '@/lib/orders/receiptProgress';
import { schedulePayloadSchema } from '@/lib/orders/scheduleValidation';

describe('status-machine transitions', () => {
  it('rejects invalid transition CALL_BACK -> INSTALL_SCHEDULING', () => {
    const res = validateTransition('CALL_BACK', 'INSTALL_SCHEDULING');
    expect(res.allowed).toBe(false);
  });

  it('allows PO_CREATED -> AWAITING_STOCK', () => {
    const res = validateTransition('PO_CREATED', 'AWAITING_STOCK');
    expect(res.allowed).toBe(true);
  });
});

describe('receipt progress', () => {
  it('computes progress correctly', () => {
    const { totalQty, receivedQty, progress } = computeReceiptProgress([
      { qty: 5, receivedQuantity: 2 },
      { qty: 5, receivedQuantity: 5 },
    ] as any);
    expect(totalQty).toBe(10);
    expect(receivedQty).toBe(7);
    expect(progress).toBe(70);
  });
});

describe('schedule payload validation', () => {
  it('requires date and minimal address fields', () => {
    const result = schedulePayloadSchema.safeParse({
      scheduledAt: new Date().toISOString(),
      address: { city: 'תל אביב', street: 'דיזנגוף', number: '10' },
    });
    expect(result.success).toBe(true);
  });

  it('fails on missing date', () => {
    const result = schedulePayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

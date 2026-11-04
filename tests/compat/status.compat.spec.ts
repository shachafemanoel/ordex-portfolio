import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const requireAuthWithRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  __esModule: true,
  requireAuthWithRole: requireAuthWithRoleMock,
}));

import { normalizeStatus } from '@/domain/status/legacyStatusMap';
import { OrderStatusManager } from '@/services/OrderStatusManager';
import { reconcileOrderStatus } from '@/services/reconciliation/reconcileOrderStatus';
import { PATCH } from '@/src/app/api/orders/[id]/status/route';

const baseOrder = {
  id: 'order-1',
  status: 'NEW',
  items: [],
  poItems: [],
  appointments: [],
};

describe('legacy status compatibility', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    requireAuthWithRoleMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps legacy value SCHEDULED -> SCHEDULE_INSTALL', () => {
    expect(normalizeStatus('SCHEDULED')).toBe('SCHEDULE_INSTALL');
  });

  it('prevents illegal transitions with 409', async () => {
    findUniqueMock.mockResolvedValueOnce({ ...baseOrder });
    const manager = new OrderStatusManager();

    await expect(
      manager.setStatus('order-1', 'WAITING_GOODS', { userId: 'u1' })
    ).rejects.toMatchObject({ code: 409 });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('infers WAITING_GOODS when any PO item is short', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseOrder,
      status: 'PO_CREATED',
      items: [
        { qty: 5, receivedQuantity: 0 },
        { qty: 3, receivedQuantity: 0 },
      ],
    });

    const result = await reconcileOrderStatus('order-1');
    expect(result).toEqual({ current: 'PURCHASE_ORDER', inferred: 'WAITING_GOODS' });
  });

  it('infers PARTIALLY_SUPPLIED for mixed receipts', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseOrder,
      status: 'WAITING_SUPPLIER',
      items: [
        { qty: 5, receivedQuantity: 2 },
        { qty: 3, receivedQuantity: 3 },
      ],
    });

    const result = await reconcileOrderStatus('order-1');
    expect(result).toEqual({ current: 'WAITING_GOODS', inferred: 'PARTIALLY_SUPPLIED' });
  });

  it('infers SCHEDULE_INSTALL when fully supplied without appointment', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseOrder,
      status: 'PARTIAL',
      items: [{ qty: 5, receivedQuantity: 5 }],
    });

    const result = await reconcileOrderStatus('order-1');
    expect(result).toEqual({ current: 'PARTIALLY_SUPPLIED', inferred: 'SCHEDULE_INSTALL' });
  });

  it('infers WAITING_INSTALL when fully supplied with appointment and not supplied', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseOrder,
      status: 'WAITING_SUPPLIER',
      items: [{ qty: 2, receivedQuantity: 2 }],
      calendarEvents: [{ id: 'appt-1' }],
    });

    const result = await reconcileOrderStatus('order-1');
    expect(result).toEqual({ current: 'WAITING_GOODS', inferred: 'WAITING_INSTALL' });
  });

  it('accepts legacy PATCH payloads and returns normalized status', async () => {
    requireAuthWithRoleMock.mockResolvedValue({ id: 'user-1' });
    findUniqueMock.mockResolvedValueOnce({
      ...baseOrder,
      status: 'WAITING_SUPPLIER',
    });
    updateMock.mockResolvedValue({ id: 'order-1', status: 'SCHEDULE_INSTALL' });

    const request = {
      json: async () => ({ status: 'scheduled', reason: 'legacy' }),
    } as unknown as NextRequest;

    const response = await PATCH(request, { params: { id: 'order-1' } });
    const body = await response.json();

    expect(requireAuthWithRoleMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: { status: 'SCHEDULE_INSTALL' },
      })
    );
    expect(body).toEqual({ success: true, status: 'SCHEDULE_INSTALL' });
  });
});

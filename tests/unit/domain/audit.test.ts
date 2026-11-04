import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logEvent } from '@/src/server/domain/audit/service';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

describe('Audit Service - logEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log an event with all parameters', async () => {
    const params = {
      orderId: 'order-1',
      action: 'TEST_ACTION',
      actorId: 'user-1',
      payload: { foo: 'bar' },
      meta: { ip: '1.2.3.4' },
      diff: { status: ['OLD', 'NEW'] },
    };

    mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-1', ...params });

    const result = await logEvent(
      params.orderId,
      params.action,
      params.actorId,
      params.payload,
      params.meta,
      params.diff
    );

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: params,
    });
    expect(result.id).toBe('audit-1');
  });

  it('should log an event with only required parameters', async () => {
    const orderId = 'order-2';
    const action = 'MINIMAL_ACTION';
    const actorId = null;
    const payload = { simple: true };

    mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-2', orderId, action, actorId, payload });

    const result = await logEvent(orderId, action, actorId, payload);

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        orderId,
        action,
        actorId,
        payload,
        meta: undefined,
        diff: undefined,
      },
    });
    expect(result.id).toBe('audit-2');
  });

  it('should handle errors from prisma', async () => {
    mockPrisma.auditEvent.create.mockRejectedValue(new Error('Prisma error'));

    await expect(logEvent('order-1', 'ACTION', null, {})).rejects.toThrow('Prisma error');
  });
});

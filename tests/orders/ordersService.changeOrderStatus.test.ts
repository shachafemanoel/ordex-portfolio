import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaAccess = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {},
  withTransaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
    operation({ order: { update: vi.fn() } })
  ),
  getPrismaClient: () => {
    prismaAccess();
    throw new Error('no database in unit tests');
  },
}));

import { OrdersService } from '@/src/server/domain/orders/OrdersService';

type TestOrder = Record<string, unknown> & { id: string; status: string };

const address = { city: 'חיפה', street: 'הרצל', number: '5' };
const baseOrder = (overrides: Partial<TestOrder> = {}): TestOrder => ({
  id: 'order-1',
  number: 'ORD-2026-0001',
  status: 'RECEIVED',
  customerName: 'דנה כהן',
  customerPhone: '0521234567',
  shippingAddress: address,
  scheduledAt: null,
  items: [{ id: 'item-1', qty: 1, received: false, allocationStatus: 'PENDING' }],
  ...overrides,
});

function createService(order: TestOrder, history: Array<{ fromStatus: string; toStatus: string }> = []) {
  const ordersRepo = {
    findById: vi.fn(async () => order),
    getStatusHistory: vi.fn(async () => history),
    updateStatus: vi.fn(async (_id: string, status: string) => ({ ...order, status })),
    createStatusHistory: vi.fn(async () => undefined),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const auditService = { logOrderStatusChange: vi.fn(async () => undefined) };
  const service = new OrdersService(
    ordersRepo as never,
    {} as never,
    {} as never,
    logger as never,
    auditService as never,
    {} as never
  );
  // Background automation is out of scope here.
  vi.spyOn(service as never, 'createAutomationTasks').mockResolvedValue(undefined as never);
  return { service, ordersRepo };
}

describe('OrdersService.changeOrderStatus', () => {
  beforeEach(() => prismaAccess.mockClear());

  it('refuses to skip from RECEIVED to COMPLETED and explains why in Hebrew', async () => {
    const { service, ordersRepo } = createService(baseOrder());

    await expect(
      service.changeOrderStatus('order-1', { newStatus: 'COMPLETED' }, 'user-1')
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('לא ניתן לעבור') });
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('does not mark items as received on its own when moving to READY', async () => {
    const { service, ordersRepo } = createService(baseOrder({ status: 'PROCESSING' }));

    await expect(
      service.changeOrderStatus('order-1', { newStatus: 'READY' }, 'user-1')
    ).rejects.toMatchObject({ message: expect.stringContaining('הפריטים') });
    expect(prismaAccess).not.toHaveBeenCalled();
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('moves to READY once items are allocated and records the reason', async () => {
    const order = baseOrder({
      status: 'PROCESSING',
      items: [{ id: 'item-1', qty: 1, received: false, allocationStatus: 'ALLOCATED' }],
    });
    const { service, ordersRepo } = createService(order);

    await service.changeOrderStatus('order-1', { newStatus: 'READY', reason: 'נארז' }, 'user-1');

    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('order-1', 'READY', expect.anything());
    expect(ordersRepo.createStatusHistory).toHaveBeenCalledWith(
      'order-1',
      'PROCESSING',
      'READY',
      'user-1',
      'נארז',
      undefined,
      expect.anything()
    );
  });

  it.each(['CANCELLED', 'ON_HOLD'])('requires a reason for %s', async (target) => {
    const { service, ordersRepo } = createService(baseOrder({ status: 'PROCESSING' }));

    await expect(
      service.changeOrderStatus('order-1', { newStatus: target as never }, 'user-1')
    ).rejects.toMatchObject({ message: 'יש לציין סיבה' });
    expect(ordersRepo.updateStatus).not.toHaveBeenCalled();

    await service.changeOrderStatus('order-1', { newStatus: target as never, reason: 'הלקוח ביקש' }, 'user-1');
    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('order-1', target, expect.anything());
  });

  it('resumes a held order only to the status it was held from', async () => {
    const history = [
      { fromStatus: 'PROCESSING', toStatus: 'ON_HOLD' },
      { fromStatus: 'RECEIVED', toStatus: 'PROCESSING' },
    ];
    const { service, ordersRepo } = createService(baseOrder({ status: 'ON_HOLD' }), history);

    await expect(
      service.changeOrderStatus('order-1', { newStatus: 'RECEIVED' }, 'user-1')
    ).rejects.toMatchObject({ message: expect.stringContaining('בטיפול') });

    await service.changeOrderStatus('order-1', { newStatus: 'PROCESSING' }, 'user-1');
    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('order-1', 'PROCESSING', expect.anything());
  });

  it('requires a date before leaving for delivery', async () => {
    const { service } = createService(baseOrder({ status: 'READY' }));

    await expect(
      service.changeOrderStatus('order-1', { newStatus: 'IN_TRANSIT' }, 'user-1')
    ).rejects.toMatchObject({ message: expect.stringContaining('תאריך') });
  });
});

describe('OrdersService hold and resume', () => {
  it('holds through the ON_HOLD status, with a reason', async () => {
    const { service, ordersRepo } = createService(baseOrder({ status: 'READY' }));

    await expect(service.holdOrder('order-1', '', 'user-1')).rejects.toMatchObject({ message: 'יש לציין סיבה' });
    await service.holdOrder('order-1', 'הלקוח בחו"ל', 'user-1');
    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('order-1', 'ON_HOLD', expect.anything());
  });

  it('resumes to the status the order was held from', async () => {
    const history = [{ fromStatus: 'READY', toStatus: 'ON_HOLD' }];
    const { service, ordersRepo } = createService(
      baseOrder({ status: 'ON_HOLD', items: [{ id: 'item-1', qty: 1, allocationStatus: 'ALLOCATED' }] }),
      history
    );

    await service.unholdOrder('order-1', 'user-1');
    expect(ordersRepo.updateStatus).toHaveBeenCalledWith('order-1', 'READY', expect.anything());
  });

  it('refuses to resume an order that is not held', async () => {
    const { service } = createService(baseOrder({ status: 'PROCESSING' }));

    await expect(service.unholdOrder('order-1', 'user-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});

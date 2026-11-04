import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderLog: {
      create: vi.fn(),
    },
    messageTemplate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    messageLog: {
      create: vi.fn(),
    },
    purchaseOrder: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/api-middleware', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    withAuth: (handler: any) => (req: any, ...args: any[]) => {
      return handler(req, { id: 'test-user-id', role: 'ADMIN' }, ...args);
    },
    createSuccessResponse: (data: any) => NextResponse.json(data, { status: 200 }),
    createErrorResponse: (msg: string, status: number) => NextResponse.json({ error: msg }, { status }),
  };
});

vi.mock('@/lib/orders/ops/workflowStateMachine', () => ({
  canExecuteAction: vi.fn(() => true),
  getActionTransition: vi.fn(() => ({
    to: 'PROCESSING',
    label: 'Test Action',
    requiresChecklistCompletion: false,
  })),
  OpsWorkflowAction: {},
  normalizeActionId: (id: string) => id,
}));

vi.mock('@/lib/orders/rules/orderSnapshot', () => ({
  buildOrderSnapshot: vi.fn(() => ({})),
}));

vi.mock('@/lib/services/orders-ops', () => ({
  computeDrillState: vi.fn(() => ({
    lane: 'NEEDS_ACTION',
    currentTask: {
      taskLabel: 'VERIFY_STOCK',
      taskLabelHe: 'Check Stock',
      steps: [{ id: 'step1', status: 'DONE', labelHe: 'Step 1' }],
      quickActions: [],
    },
    progressPct: 100,
    isSnoozed: false,
    snoozeUntil: null,
  })),
}));

import { POST } from '@/app/api/orders/[id]/drill/action/route';

const mockOrder = {
  id: 'order-log-test',
  number: '5002',
  status: 'TO_DO',
  items: [],
};

describe('Drill Action Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
    mockPrisma.order.update.mockResolvedValue(mockOrder);
    mockPrisma.orderLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
  });

  it('should log action to OrderLog', async () => {
    const req = new NextRequest('http://localhost/api/orders/order-log-test/drill/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId: 'mark-customer-contacted',
      }),
    });

    const res = await POST(req, { params: { id: 'order-log-test' } });

    expect(res.status).toBe(200);

    expect(mockPrisma.orderLog.create).toHaveBeenCalled();
    expect(mockPrisma.orderLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-log-test',
        userId: 'test-user-id',
        action: 'mark-customer-contacted',
        metadata: expect.objectContaining({
            taskLabel: 'VERIFY_STOCK',
        })
      }),
    }));
  });
});

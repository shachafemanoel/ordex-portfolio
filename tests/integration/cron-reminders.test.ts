import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted so the mock object is available when vi.mock factories run
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    order: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma,
  prismaClient: mockPrisma,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock the rules engine to avoid deep dependency chain
vi.mock('@/lib/orders/rules/resolveTaskState', () => ({
  resolveTaskState: vi.fn(() => ({
    taskLabel: 'VERIFY_STOCK',
    taskLabelHe: 'בדיקת מלאי',
    checklist: [
      { id: 'has_payment', labelHe: 'תשלום התקבל', status: 'DONE', actionHint: null, missingFields: [] },
    ],
    allowedQuickActions: [],
    isBlocked: false,
    blockReasons: [],
    deferBucket: 'ACTIVE',
  })),
}));

import { GET } from '@/app/api/cron/process-reminders/route';

describe('Process Reminders Cron (consolidated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('should return 401 if unauthorized', async () => {
    const req = new NextRequest('http://localhost/api/cron/process-reminders');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return success with 0 processed when no expired snoozes', async () => {
    const req = new NextRequest('http://localhost/api/cron/process-reminders', {
      headers: { authorization: 'Bearer test-secret' },
    });

    mockPrisma.order.findMany.mockResolvedValue([]);

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results.processed).toBe(0);
    expect(json.message).toBe('No expired snoozes found');
  });

  it('should process expired snoozes through computeDrillState', async () => {
    const req = new NextRequest('http://localhost/api/cron/process-reminders', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const mockOrder = {
      id: 'order-1',
      number: '1001',
      status: 'TO_DO',
      paymentStatus: 'PAID',
      customerRequestCallback: false,
      opsSnoozeUntil: new Date('2023-01-01'),
      opsSnoozeReason: 'test',
      opsChecklistState: {},
      opsLane: 'WAITING',
      city: 'Tel Aviv',
      street: 'Rothschild',
      houseNumber: '1',
      floor: null,
      notesToCrew: null,
      addressValidationStatus: null,
      scheduledAt: null,
      items: [{ sku: 'SKU-1', qty: 2, receivedQuantity: 0, supplierId: null }],
      shippingAddress: null,
      calendarEvents: [],
    };

    mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
    mockPrisma.order.update.mockResolvedValue({});

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results.processed).toBe(1);
    expect(json.laneDistribution).toBeDefined();

    // Verify update was called with computed state
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        opsSnoozeUntil: null,
        opsSnoozeReason: null,
        opsLane: expect.any(String),
        opsCurrentTask: expect.any(String),
        opsStatus: expect.any(String),
        lastActionAt: expect.any(Date),
      }),
    });
  });
});

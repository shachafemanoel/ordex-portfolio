/**
 * Integration tests for Drill API endpoints.
 *
 * Tests the full flow:
 * 1. GET drill state
 * 2. POST check (toggle checklist step) -> verify DB update
 * 3. POST snooze -> verify opsLane is WAITING
 * 4. POST wake -> verify opsLane is NEEDS_ACTION
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted so the mock object is available when vi.mock factories run
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    order: {
      findUnique: vi.fn(),
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

// Mock the rules engine
vi.mock('@/lib/orders/rules/resolveTaskState', () => ({
  resolveTaskState: vi.fn(() => ({
    taskLabel: 'VERIFY_STOCK',
    taskLabelHe: 'בדיקת מלאי',
    checklist: [
      { id: 'has_payment', labelHe: 'תשלום התקבל', status: 'DONE', actionHint: null, missingFields: [] },
      { id: 'stock_check', labelHe: 'בדיקת מלאי', status: 'TODO', actionHint: 'Check stock levels', missingFields: [] },
    ],
    allowedQuickActions: [],
    isBlocked: false,
    blockReasons: [],
    deferBucket: 'ACTIVE',
  })),
}));

// Import routes after mocking
import { GET } from '@/app/api/orders/[id]/drill/route';
import { POST as checkPost } from '@/app/api/orders/[id]/drill/check/route';
import { POST as snoozePost } from '@/app/api/orders/[id]/drill/snooze/route';
import { POST as wakePost } from '@/app/api/orders/[id]/drill/wake/route';

const mockOrder = {
  id: 'order-drill-test',
  number: '5001',
  status: 'TO_DO',
  paymentStatus: 'PAID',
  customerRequestCallback: false,
  city: 'Haifa',
  street: 'Ben Gurion',
  houseNumber: '10',
  floor: null,
  notesToCrew: null,
  addressValidationStatus: null,
  scheduledAt: null,
  opsChecklistState: {},
  opsSnoozeUntil: null,
  opsSnoozeReason: null,
  opsLane: 'NEEDS_ACTION',
  opsCurrentTask: 'VERIFY_STOCK',
  items: [{ sku: 'SKU-A', qty: 1, receivedQuantity: 0, supplierId: null }],
  shippingAddress: null,
  calendarEvents: [],
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Drill API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder });
    mockPrisma.order.update.mockResolvedValue({ ...mockOrder });
  });

  describe('GET /api/orders/[id]/drill', () => {
    it('should return drill state for an order', async () => {
      const req = new NextRequest('http://localhost/api/orders/order-drill-test/drill');

      const res = await GET(req, await makeParams('order-drill-test'));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.lane).toBeDefined();
      expect(json.currentTask).toBeDefined();
      expect(json.currentTask.taskLabel).toBe('VERIFY_STOCK');
      expect(json.progressPct).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/orders/nonexistent/drill');
      const res = await GET(req, await makeParams('nonexistent'));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/orders/[id]/drill/check', () => {
    it('should update checklist and recompute state', async () => {
      const req = new NextRequest('http://localhost/api/orders/order-drill-test/drill/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskLabel: 'VERIFY_STOCK',
          stepId: 'stock_check',
          checked: true,
        }),
      });

      const res = await checkPost(req, await makeParams('order-drill-test'));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.lane).toBeDefined();
      expect(json.currentTask).toBeDefined();

      // Verify DB update
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-drill-test' },
        data: expect.objectContaining({
          opsChecklistState: expect.objectContaining({
            VERIFY_STOCK: expect.objectContaining({
              stock_check: true,
            }),
          }),
          opsLane: expect.any(String),
          opsCurrentTask: expect.any(String),
        }),
      });
    });

    it('should return 400 for missing fields', async () => {
      const req = new NextRequest('http://localhost/api/orders/order-drill-test/drill/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskLabel: 'VERIFY_STOCK' }),
      });

      const res = await checkPost(req, await makeParams('order-drill-test'));
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/orders/[id]/drill/snooze', () => {
    it('should set snooze and update lane to WAITING', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      const req = new NextRequest('http://localhost/api/orders/order-drill-test/drill/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          until: futureDate.toISOString(),
          reason: 'ממתין לספק',
        }),
      });

      const res = await snoozePost(req, await makeParams('order-drill-test'));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.lane).toBe('WAITING');
      expect(json.isSnoozed).toBe(true);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-drill-test' },
        data: expect.objectContaining({
          opsSnoozeUntil: expect.any(Date),
          opsSnoozeReason: 'ממתין לספק',
          opsLane: 'WAITING',
        }),
      });
    });

    it('should return 400 for missing until field', async () => {
      const req = new NextRequest('http://localhost/api/orders/order-drill-test/drill/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'no date' }),
      });

      const res = await snoozePost(req, await makeParams('order-drill-test'));
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/orders/[id]/drill/wake', () => {
    it('should clear snooze and update lane to NEEDS_ACTION', async () => {
      const snoozedOrder = {
        ...mockOrder,
        opsSnoozeUntil: new Date(Date.now() + 86400000),
        opsSnoozeReason: 'test snooze',
        opsLane: 'WAITING',
      };
      mockPrisma.order.findUnique.mockResolvedValue(snoozedOrder);

      const req = new NextRequest('http://localhost/api/orders/order-drill-test/drill/wake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await wakePost(req, await makeParams('order-drill-test'));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.isSnoozed).toBe(false);
      expect(json.lane).toBe('NEEDS_ACTION');

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-drill-test' },
        data: expect.objectContaining({
          opsSnoozeUntil: null,
          opsSnoozeReason: null,
          opsLane: 'NEEDS_ACTION',
        }),
      });
    });
  });

  describe('Full flow: check -> snooze -> wake', () => {
    it('should handle the complete lifecycle', async () => {
      // Step 1: Check a step
      const checkReq = new NextRequest('http://localhost/api/orders/order-drill-test/drill/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskLabel: 'VERIFY_STOCK',
          stepId: 'stock_check',
          checked: true,
        }),
      });

      const checkRes = await checkPost(checkReq, await makeParams('order-drill-test'));
      expect(checkRes.status).toBe(200);

      // Step 2: Snooze
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 4);

      const snoozeReq = new NextRequest('http://localhost/api/orders/order-drill-test/drill/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ until: futureDate.toISOString(), reason: '4 שעות' }),
      });

      const snoozeRes = await snoozePost(snoozeReq, await makeParams('order-drill-test'));
      expect(snoozeRes.status).toBe(200);
      const snoozeJson = await snoozeRes.json();
      expect(snoozeJson.lane).toBe('WAITING');

      // Step 3: Wake
      const wakeReq = new NextRequest('http://localhost/api/orders/order-drill-test/drill/wake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const wakeRes = await wakePost(wakeReq, await makeParams('order-drill-test'));
      expect(wakeRes.status).toBe(200);
      const wakeJson = await wakeRes.json();
      expect(wakeJson.lane).toBe('NEEDS_ACTION');
      expect(wakeJson.isSnoozed).toBe(false);
    });
  });
});

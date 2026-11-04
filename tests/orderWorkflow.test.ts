import { describe, it, expect } from 'vitest';
import type { OrderWorkflowSnapshot } from '@/domain/orders/orderWorkflow';
import { evaluateWorkflow } from '@/domain/orders/orderWorkflow';

const baseSnapshot = (): OrderWorkflowSnapshot => ({
  id: 'order-1',
  number: '1001',
  status: 'DRAFT',
  statusRaw: 'DRAFT',
  customer: {
    id: 'cust-1',
    fullName: 'לקוח בדיקה',
    phone: '050-0000000',
    email: 'test@example.com',
    city: 'תל אביב',
    street: 'דרך השלום',
    houseNumber: '10',
    floor: null,
    notes: null,
    accountNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  items: [
    {
      id: 'item-1',
      name: 'שולחן',
      quantity: 1,
      unitPrice: 1000,
      totalPrice: 1000,
      received: false,
    },
  ],
  totalAmount: 1000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  assignedUserId: 'user-1',
  assignedUserName: 'מנהל',
  notesCount: 1,
  purchaseOrders: [],
  expectedStockAt: null,
  calendarEvents: [],
  shipments: [],
  payments: [],
  outstandingBalance: 1000,
});

describe('order workflow definition', () => {
  it('validates draft requirements', () => {
    const snapshot = baseSnapshot();
    const workflow = evaluateWorkflow(snapshot);
    expect(workflow.status).toBe('DRAFT');
    expect(workflow.requirements.every((req) => req.satisfied)).toBe(true);
    expect(workflow.allowedNext).toContain('RECEIVED');
  });

  it('flags missing purchase order data', () => {
    const snapshot = baseSnapshot();
    snapshot.status = 'AWAITING_STOCK';
    const workflow = evaluateWorkflow(snapshot);
    const requirements = workflow.requirements.reduce<Record<string, boolean>>((acc, req) => {
      acc[req.id] = req.satisfied;
      return acc;
    }, {});
    expect(requirements.purchase_orders).toBe(false);
    expect(requirements.expected_arrival).toBe(false);
  });

  it('requires all items before scheduling install', () => {
    const snapshot = baseSnapshot();
    snapshot.status = 'READY_FOR_INSTALL';
    snapshot.items = snapshot.items.map((item) => ({ ...item, received: false }));
    const workflow = evaluateWorkflow(snapshot);
    const availability = workflow.requirements.find((req) => req.id === 'all_items_available');
    expect(availability?.satisfied).toBe(false);
  });

  it('computes transition requirement readiness', () => {
    const snapshot = baseSnapshot();
    snapshot.status = 'PROCESSING';
    snapshot.purchaseOrders = [
      { id: 'po-1', reference: 'PO-1', status: 'SENT', expectedAt: new Date().toISOString(), supplierName: 'ספק' },
    ];
    const workflow = evaluateWorkflow(snapshot);
    const awaitingStock = workflow.transitions.find((transition) => transition.target === 'READY');
    expect(awaitingStock).toBeDefined();
    expect(workflow.allowedNext).not.toContain('COMPLETED');
  });
});

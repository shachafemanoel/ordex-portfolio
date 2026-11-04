import { normalizeCustomer } from '@/domain/customers/normalizeCustomer';
import { normalizeOrder } from '@/domain/orders/normalizeOrder';
import { normalizePayment } from '@/domain/payments/normalizePayment';
import { normalizeRole } from '@/domain/roles/normalizeRole';
import { normalizeUser } from '@/domain/users/normalizeUser';
import { describe, expect, it } from 'vitest';

describe('domain normalizers', () => {
  describe('roles', () => {
    it('normalizes explicit enum values', () => {
      const role = normalizeRole('ADMIN');
      expect(role).toMatchObject({ key: 'ADMIN', label: 'מנהל' });
    });

    it('maps legacy aliases to canonical roles', () => {
      const role = normalizeRole('sales_rep');
      expect(role.key).toBe('OPERATIONS');
    });
  });

  describe('users', () => {
    it('maps prisma user into DTO shape', () => {
      const user = normalizeUser({
        id: 'u1',
        email: 'ops@example.com',
        name: 'Ops User',
        role: 'OPERATIONS',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      } as any);

      expect(user.fullName).toBe('Ops User');
      expect(user.role!.key).toBe('OPERATIONS');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('derives full name and active flag from legacy fields', () => {
      const user = normalizeUser({
        id: 'legacy',
        email: 'legacy@example.com',
        full_name: 'Legacy Person',
        roleName: 'admin',
        status: 'inactive',
      } as any);

      expect(user.fullName).toBe('Legacy Person');
      expect(user.role.key).toBe('ADMIN');
      expect(user.isActive).toBe(false);
    });
  });

  describe('customers', () => {
    it('normalizes customer with direct fields', () => {
      const customer = normalizeCustomer({
        id: 'c1',
        name: 'דני',
        phone: '050-0000000',
        email: 'dani@example.com',
        city: 'Tel Aviv',
        createdAt: new Date('2024-02-02T00:00:00Z'),
      } as any);

      expect(customer.fullName).toBe('דני');
      expect(customer.phone).toBe('050-0000000');
      expect(customer.city).toBe('Tel Aviv');
      expect(customer.createdAt.toISOString()).toContain('2024-02-02');
    });

    it('handles legacy snake_case address fields', () => {
      const customer = normalizeCustomer({
        id: 'legacy',
        full_name: 'Legacy Customer',
        phone_number: '+97250000001',
        address_city: 'Jerusalem',
        address_street: 'King George',
        house_number: '10',
      } as any);

      expect(customer.fullName).toBe('Legacy Customer');
      expect(customer.city).toBe('Jerusalem');
      expect(customer.street).toBe('King George');
      expect(customer.houseNumber).toBe('10');
    });
  });

  describe('orders', () => {
    it('normalizes orders with nested customer and items', () => {
      const order = normalizeOrder({
        id: 'o1',
        number: '1001',
        status: 'READY_FOR_INSTALL',
        totalCents: 25000,
        createdAt: new Date('2024-03-03T00:00:00Z'),
        customer: {
          id: 'c2',
          name: 'Customer B',
          phone: '050-2000000',
          email: 'b@example.com',
        },
        items: [
          { id: 'item-1', name: 'Item 1', qty: 2, unitPriceCents: 5000, totalCents: 10000 },
          { id: 'item-2', name: 'Item 2', qty: 1, unitPriceCents: 15000, totalCents: 15000 },
        ],
      } as any);

      expect(order.customer?.name).toBe('Customer B');
      expect(order.items).toHaveLength(2);
      expect(order.totalAmount).toBe(250);
      expect(order.createdAt).toContain('2024-03-03');
    });

    it('maps legacy status strings and computes totals from items', () => {
      const order = normalizeOrder({
        id: 'legacy',
        orderNumber: 'L-1',
        status: 'installing_now',
        lineItems: [{ id: 'l1', name: 'Legacy', quantity: 3, price: 100 }],
      } as any);

      expect(order.status).toBe('SCHEDULED');
      expect(order.totalAmount).toBe(300);
      expect(order.items[0].quantity).toBe(3);
    });
  });

  describe('payments', () => {
    it('normalizes payments from prisma rows', () => {
      const payment = normalizePayment({
        id: 'p1',
        orderId: 'o1',
        amountCents: 12345,
        method: 'card',
        paidAt: new Date('2024-04-04T00:00:00Z'),
        reference: 'TX123',
      } as any);

      expect(payment.amount).toBeCloseTo(123.45);
      expect(payment.method).toBe('CARD');
      expect(payment.paidAt).toContain('2024-04-04');
      expect(payment.reference).toBe('TX123');
    });

    it('handles legacy snake_case fields', () => {
      const payment = normalizePayment({
        id: 'legacy',
        order_id: 'o9',
        amount_cents: 5000,
        method: 'cash',
        paid_at: '2024-05-01T00:00:00Z',
        external_id: 'LEG-1',
      } as any);

      expect(payment.orderId).toBe('o9');
      expect(payment.amount).toBe(50);
      expect(payment.method).toBe('CASH');
      expect(payment.reference).toBe('LEG-1');
    });
  });
});

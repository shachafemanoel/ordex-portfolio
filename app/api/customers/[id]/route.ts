export const dynamic = 'force-dynamic';

import { normalizeCustomer } from '@/domain/customers/normalizeCustomer';
import { createDataResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { prisma, withTransaction } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const addressSchema = z.object({
  city: z.string().min(1, 'עיר חובה'),
  street: z.string().min(1, 'רחוב חובה'),
  number: z.string().min(1, 'מספר בית חובה'),
  floor: z.string().optional().nullable(),
  apartment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const customerUpdateSchema = z.object({
  name: z.string().min(1, 'שם הלקוח חובה').optional(),
  email: z.string().email('כתובת אימייל לא תקינה').optional().nullable(),
  phone: z.string().min(9, 'מספר טלפון חייב להכיל לפחות 9 ספרות').optional().nullable(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  creditLimitCents: z.number().int().min(0).max(10_000_000_00).optional().nullable(),
  paymentTermsDays: z.number().int().min(0).max(360).optional().nullable(),
  accountNotes: z.string().max(2000).optional().nullable(),
});

const trimOrNull = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeAddressInput = (address?: z.infer<typeof addressSchema>) => {
  if (!address) return undefined;
  return {
    city: address.city.trim(),
    street: address.street.trim(),
    number: address.number.trim(),
    floor: trimOrNull(address.floor ?? null),
    apartment: trimOrNull(address.apartment ?? null),
    notes: trimOrNull(address.notes ?? null),
  };
};

/**
 * GET /api/customers/[id]
 * Get customer details with addresses and orders
 * @requires ADMIN or SALES role
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    _user: AuthenticatedUser,
    { params }: { params: { id: string } }
  ) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: params.id },
        include: {
          addresses: {
            orderBy: { createdAt: 'desc' },
          },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 10, // Last 10 orders
            select: {
              id: true,
              number: true,
              status: true,
              totalCents: true,
              createdAt: true,
            },
          },
          ledgerEntries: {
            orderBy: { createdAt: 'desc' },
            take: 25,
            include: {
              order: { select: { id: true, number: true, status: true } },
              payment: { select: { id: true, method: true } },
            },
          },
          _count: {
            select: { orders: true },
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'לקוח לא נמצא',
              code: 'NOT_FOUND',
            },
          },
          { status: 404 }
        );
      }

      const rawOutstanding = await prisma.order.findMany({
        where: {
          customerId: params.id,
          totalCents: { gt: 0 },
        },
        select: {
          id: true,
          number: true,
          status: true,
          totalCents: true,
          paidAmountCents: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });

      type OutstandingOrder = {
        id: string;
        number: string;
        status: (typeof rawOutstanding)[number]['status'];
        totalCents: number;
        paidAmountCents: number;
        balanceCents: number;
        createdAt: Date;
        dueDate: Date | null;
        isOverdue: boolean;
      };

      const outstandingOrders = rawOutstanding
        .map<OutstandingOrder | null>((order) => {
          const balanceCents = order.totalCents - order.paidAmountCents;
          if (balanceCents <= 0) {
            return null;
          }

          const paymentTermsDays = customer.paymentTermsDays ?? null;
          const dueDate =
            paymentTermsDays != null
              ? new Date(order.createdAt.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000)
              : null;
          const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;

          return {
            id: order.id,
            number: order.number,
            status: order.status,
            totalCents: order.totalCents,
            paidAmountCents: order.paidAmountCents,
            balanceCents,
            createdAt: order.createdAt,
            dueDate,
            isOverdue,
          };
        })
        .filter((order): order is OutstandingOrder => order !== null);

      const lastPaymentEntry = customer.ledgerEntries?.find((entry) => entry.type === 'PAYMENT');

      const accountSummary = {
        currentBalanceCents: customer.currentBalanceCents,
        creditLimitCents: customer.creditLimitCents ?? null,
        availableCreditCents:
          customer.creditLimitCents != null
            ? customer.creditLimitCents - customer.currentBalanceCents
            : null,
        paymentTermsDays: customer.paymentTermsDays ?? null,
        overdueOrdersCount: outstandingOrders.filter((order) => order.isOverdue).length,
        lastPaymentAt: lastPaymentEntry?.createdAt ?? null,
      };

      return createDataResponse(
        normalizeCustomer({
          ...customer,
          outstandingOrders,
          accountSummary,
        })
      );
    } catch (error) {
      console.error('Error fetching customer:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'שגיאה בטעינת נתוני לקוח',
            code: 'FETCH_ERROR',
          },
        },
        { status: 500 }
      );
    }
  }
);

/**
 * PATCH /api/customers/[id]
 * Update customer details
 * @requires ADMIN or SALES role
 */
export const PATCH = withAuth(
  async (
    request: NextRequest,
    _user: AuthenticatedUser,
    { params }: { params: { id: string } }
  ) => {
    try {
      const body = await request.json();

      // Validate input
      const validatedData = customerUpdateSchema.parse(body);

      // Check if customer exists
      const existing = await prisma.customer.findUnique({
        where: { id: params.id },
      });

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'לקוח לא נמצא',
              code: 'NOT_FOUND',
            },
          },
          { status: 404 }
        );
      }

      const { billingAddress, shippingAddress, ...customerData } = validatedData;

      const sanitizedBilling = sanitizeAddressInput(billingAddress);
      const sanitizedShipping = sanitizeAddressInput(shippingAddress);

      const updatePayload: Prisma.CustomerUpdateInput = {};
      if (customerData.name !== undefined) {
        updatePayload.name = customerData.name.trim();
      }
      if (customerData.email !== undefined) {
        updatePayload.email =
          typeof customerData.email === 'string' ? customerData.email.trim() : customerData.email;
      }
      if (customerData.phone !== undefined) {
        updatePayload.phone =
          typeof customerData.phone === 'string' ? customerData.phone.trim() : customerData.phone;
      }
      if (customerData.creditLimitCents !== undefined) {
        updatePayload.creditLimitCents = customerData.creditLimitCents ?? null;
      }
      if (customerData.paymentTermsDays !== undefined) {
        updatePayload.paymentTermsDays = customerData.paymentTermsDays ?? null;
      }
      if (customerData.accountNotes !== undefined) {
        updatePayload.accountNotes =
          typeof customerData.accountNotes === 'string'
            ? customerData.accountNotes.trim() || null
            : customerData.accountNotes;
      }

      const customer = await withTransaction(async (tx) => {
        if (Object.keys(updatePayload).length > 0) {
          await tx.customer.update({
            where: { id: params.id },
            data: updatePayload,
          });
        }

        if (sanitizedBilling) {
          const existingBilling = await tx.address.findFirst({
            where: { customerId: params.id, type: 'BILLING' },
          });

          if (existingBilling) {
            await tx.address.update({
              where: { id: existingBilling.id },
              data: sanitizedBilling,
            });
          } else {
            await tx.address.create({
              data: {
                customerId: params.id,
                type: 'BILLING',
                ...sanitizedBilling,
              },
            });
          }
        }

        if (sanitizedShipping) {
          const existingShipping = await tx.address.findFirst({
            where: { customerId: params.id, type: 'SHIPPING' },
          });

          if (existingShipping) {
            await tx.address.update({
              where: { id: existingShipping.id },
              data: sanitizedShipping,
            });
          } else {
            await tx.address.create({
              data: {
                customerId: params.id,
                type: 'SHIPPING',
                ...sanitizedShipping,
              },
            });
          }
        }

        const refreshed = await tx.customer.findUnique({
          where: { id: params.id },
          include: {
            addresses: {
              orderBy: { createdAt: 'desc' },
            },
            orders: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                number: true,
                status: true,
                totalCents: true,
                createdAt: true,
              },
            },
            _count: {
              select: { orders: true },
            },
          },
        });

        if (!refreshed) {
          throw new Error('Customer missing after update');
        }

        return refreshed;
      });

      return createDataResponse(normalizeCustomer(customer));
    } catch (error) {
      console.error('Error updating customer:', error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'נתונים לא תקינים',
              code: 'VALIDATION_ERROR',
              details: error.errors,
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'שגיאה בעדכון לקוח',
            code: 'UPDATE_ERROR',
          },
        },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/customers/[id]
 * Delete customer (only if no orders exist)
 * @requires ADMIN role only (destructive operation)
 */
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    _user: AuthenticatedUser,
    { params }: { params: { id: string } }
  ) => {
    try {
      // Check if customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: params.id },
        include: {
          _count: {
            select: { orders: true },
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'לקוח לא נמצא',
              code: 'NOT_FOUND',
            },
          },
          { status: 404 }
        );
      }

      // Prevent deletion if customer has orders
      if (customer._count.orders > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `לא ניתן למחוק לקוח עם ${customer._count.orders} הזמנות קיימות`,
              code: 'HAS_ORDERS',
            },
          },
          { status: 400 }
        );
      }

      // Delete customer and their addresses in transaction
      await prisma.$transaction(async (tx) => Promise.all([
        tx.address.deleteMany({ where: { customerId: params.id } }),
        tx.customer.delete({ where: { id: params.id } }),
      ]));

      return NextResponse.json({
        success: true,
        message: 'לקוח נמחק בהצלחה',
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'שגיאה במחיקת לקוח',
            code: 'DELETE_ERROR',
          },
        },
        { status: 500 }
      );
    }
  },
  { roles: ['ADMIN'] } // Only admins can delete customers
);

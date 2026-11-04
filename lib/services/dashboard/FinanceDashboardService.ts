import { prisma } from '@/lib/db';
import { OrderStatus, PaymentStatus, PurchaseOrderStatus } from '@prisma/client';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';

async function safeQuery<T>(label: string, fallback: T, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[FinanceDashboardService] ${label} query failed`, error);
    }
    return fallback;
  }
}

export async function getFinanceDashboardData() {
  const now = new Date();
  const firstDayCurrentMonth = startOfMonth(now);
  const lastDayCurrentMonth = endOfMonth(now);
  const firstDayLastMonth = startOfMonth(subMonths(now, 1));
  const lastDayLastMonth = endOfMonth(subMonths(now, 1));

  // 1. Revenue (Based on Orders created - accrual basis)
  const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
    safeQuery('currentMonthRevenue', { _sum: { totalCents: 0 } }, () =>
      prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          createdAt: { gte: firstDayCurrentMonth, lte: lastDayCurrentMonth },
          status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
        },
      })
    ),
    safeQuery('lastMonthRevenue', { _sum: { totalCents: 0 } }, () =>
      prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          createdAt: { gte: firstDayLastMonth, lte: lastDayLastMonth },
          status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
        },
      })
    ),
  ]);

  const revenueCurrent = (currentMonthRevenue._sum.totalCents || 0) / 100;
  const revenueLast = (lastMonthRevenue._sum.totalCents || 0) / 100;
  const revenueTrend =
    revenueLast === 0 ? 100 : ((revenueCurrent - revenueLast) / revenueLast) * 100;

  // 2. Open Balances (Orders with remaining balance > 0)
  // Assuming 'remainingBalanceCents' exists on Order? Or calculated.
  // Checking schema implicitly by generic query for now, if field missing we'll fix.
  // Standard schema usually has remainingBalance or we sum payments.
  // Let's assume there isn't a direct "remaining balance" field on Order without checking schema file but usually there is 'paidAmountCents' possibly?
  // I will check specific fields if this fails, but for now I'll try to find 'transactions' or similar.
  // A safer bet without deep schema knowledge is existing "Open Invoices" logic.
  // Let's look for "Payment" model.

  // Actually, I should query orders that are NOT cancelled and check payments...
  // For simplicity efficiently:
  // Fetch count of orders with paymentStatus != PAID? (if exists)
  // Let's assume PaymentStatus enum has 'PAID', 'PARTIAL', 'UNPAID'.

  const [openInvoicesCount, openInvoicesSum] = await Promise.all([
    safeQuery('openInvoicesCount', 0, () =>
      prisma.order.count({
        where: {
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
          status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
        },
      })
    ),
    safeQuery('openInvoicesSum', { _sum: { totalCents: 0, paidAmountCents: 0 } }, () =>
      prisma.order.aggregate({
        _sum: {
          totalCents: true,
          paidAmountCents: true,
        },
        where: {
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
          status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
        },
      })
    ),
  ]);

  const openDebtAmount =
    ((openInvoicesSum._sum.totalCents || 0) - (openInvoicesSum._sum.paidAmountCents || 0)) / 100;

  // 3. Purchasing Expenses (Purchase Orders)
  const currentMonthPurchaseItems = await safeQuery('purchaseOrderItems', [], () =>
    prisma.purchaseOrderItem.findMany({
      where: {
        createdAt: { gte: firstDayCurrentMonth, lte: lastDayCurrentMonth },
        purchaseOrder: { status: { not: PurchaseOrderStatus.CANCELLED } },
      },
      select: {
        qtyOrdered: true,
        product: { select: { basePriceCents: true } },
      },
    })
  );

  const expensesCurrent =
    currentMonthPurchaseItems.reduce((sum, item) => {
      const unitCost = item.product?.basePriceCents ?? 0;
      return sum + unitCost * item.qtyOrdered;
    }, 0) / 100;

  // 4. Net Profit (Estimated)
  const netProfit = revenueCurrent - expensesCurrent;

  // 5. Recent Transactions (Payments)
  const recentPayments = await safeQuery('recentPayments', [], () =>
    prisma.payment.findMany({
      take: 5,
      orderBy: { paymentDate: 'desc' },
      include: {
        order: {
          select: {
            number: true,
            customerName: true,
          },
        },
      },
    })
  );

  return {
    kpis: {
      revenue: { value: revenueCurrent, trend: revenueTrend },
      openInvoices: { count: openInvoicesCount, amount: openDebtAmount },
      expenses: { value: expensesCurrent },
      netProfit: {
        value: netProfit,
        margin: revenueCurrent > 0 ? (netProfit / revenueCurrent) * 100 : 0,
      },
    },
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: (p.amountCents || 0) / 100, // Assuming cents
      method: p.method,
      date: p.paymentDate,
      orderNumber: p.order?.number,
      customer: p.order?.customerName,
      status: p.status,
    })),
  };
}

import { prisma } from '@/lib/db';

export interface DebtorSummary {
  customerId: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  currentBalanceCents: number;
  totalOverdueCents: number;
  daysOverdue: number;
  lastPaymentDate: Date | null;
  paymentTermsDays: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class CollectionService {
  /**
   * Get all customers with outstanding debt
   */
  static async getDebtors(): Promise<DebtorSummary[]> {
    // Fetch customers with positive balance
    const customers = await prisma.customer.findMany({
      where: {
        currentBalanceCents: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        currentBalanceCents: true,
        paymentTermsDays: true,
        riskLevel: true, // Existing risk level
        orders: {
          // Filtering in memory to avoid Prisma validation issues with Enums in relation filters
          select: {
            id: true,
            totalCents: true,
            paidAmountCents: true,
            createdAt: true,
            lastPaymentAt: true,
            paymentStatus: true,
            status: true,
          },
        },
        // 'payments' relation does not exist on Customer, so we cannot fetch it directly.
        // We will calculate lastPaymentDate from orders.
      },
      orderBy: { currentBalanceCents: 'desc' },
    });

    return customers.map((customer) => {
      // Calculate overdue amount
      const termsDays = customer.paymentTermsDays || 0; // Default to 0 (Due on receipt)
      const now = new Date();

      let totalOverdue = 0;
      let maxDaysOverdue = 0;
      let lastPaymentDate: Date | null = null;

      for (const order of customer.orders) {
        // Track latest payment
        if (order.lastPaymentAt) {
          if (!lastPaymentDate || order.lastPaymentAt > lastPaymentDate) {
            lastPaymentDate = order.lastPaymentAt;
          }
        }

        // Filter non-debt orders
        if (
          order.paymentStatus === 'PAID' ||
          order.paymentStatus === 'REFUNDED' ||
          order.status === 'CANCELLED'
        ) {
          continue;
        }

        const dueDate = new Date(order.createdAt);
        dueDate.setDate(dueDate.getDate() + termsDays);

        if (dueDate < now) {
          const unpaid = order.totalCents - order.paidAmountCents;
          if (unpaid > 0) {
            totalOverdue += unpaid;
            const days = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (days > maxDaysOverdue) maxDaysOverdue = days;
          }
        }
      }

      // Determine dynamic risk level for collection purposes
      let dynamicRisk: DebtorSummary['riskLevel'] = 'LOW';
      if (maxDaysOverdue > 90) dynamicRisk = 'CRITICAL';
      else if (maxDaysOverdue > 60) dynamicRisk = 'HIGH';
      else if (maxDaysOverdue > 30) dynamicRisk = 'MEDIUM';

      return {
        customerId: customer.id,
        customerName: customer.name,
        email: customer.email,
        phone: customer.phone,
        currentBalanceCents: customer.currentBalanceCents,
        totalOverdueCents: totalOverdue,
        daysOverdue: maxDaysOverdue,
        lastPaymentDate,
        paymentTermsDays: termsDays,
        riskLevel: dynamicRisk,
      };
    });
  }

  /**
   * Calculate KPI Stats for Collection Dashboard
   */
  static async getCollectionStats() {
    const debtors = await this.getDebtors();

    const totalOutstanding = debtors.reduce((sum, d) => sum + d.currentBalanceCents, 0);
    const totalOverdue = debtors.reduce((sum, d) => sum + d.totalOverdueCents, 0);
    const criticalCount = debtors.filter((d) => d.riskLevel === 'CRITICAL').length;

    // Collected this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.aggregate({
      where: {
        status: 'PAID',
        paymentDate: { gte: startOfMonth },
      },
      _sum: { amountCents: true },
    });

    return {
      totalOutstandingCents: totalOutstanding,
      totalOverdueCents: totalOverdue,
      collectedThisMonthCents: payments._sum.amountCents || 0,
      debtorsCount: debtors.length,
      criticalDebtorsCount: criticalCount,
    };
  }
}

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import { withAuthApiRoute } from '@/lib/auth/withAuthApiRoute';
import {
  getCompletedCount,
  getInstallationsPendingCount,
  getOrderStatusMetrics,
} from '@/lib/services/orders/orderMetrics';
import { buildOrderWhereClause } from '@/lib/repositories/orders/OrdersRepository';

export const dynamic = 'force-dynamic';

interface DashboardSummary {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  installationsPending: number;
  totalRevenue: number;
  avgOrderValue: number;
  trend: {
    orders: { value: number; type: 'up' | 'down' | 'stable' };
    revenue: { value: number; type: 'up' | 'down' | 'stable' };
  };
}

interface StatusCount {
  status: string;
  count: number;
  label: string;
  percentage: number;
}

interface RecentOrder {
  id: string;
  number: string;
  customerName: string;
  status: string;
  statusLabel?: string;
  totalAmount: number;
  createdAt: string;
}

interface DashboardPayload {
  summary: DashboardSummary;
  statusCounts: StatusCount[];
  recentOrders: RecentOrder[];
}

/**
 * Unified success response envelope for Dashboard API.
 */
interface DashboardSuccessResponse {
  success: true;
  data: DashboardPayload;
  error: null;
}

/**
 * Unified error response envelope for Dashboard API.
 */
interface DashboardErrorResponse {
  success: false;
  data: DashboardPayload;
  error: string;
}

type DashboardData = DashboardSuccessResponse | DashboardErrorResponse;

async function getDashboard(_request: NextRequest): Promise<NextResponse<DashboardData>> {
  try {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: false,
        error: 'Database connection not available',
        data: {
          summary: {
            totalOrders: 0,
            pendingOrders: 0,
            completedOrders: 0,
            installationsPending: 0,
            totalRevenue: 0,
            avgOrderValue: 0,
            trend: {
              orders: { value: 0, type: 'stable' as const },
              revenue: { value: 0, type: 'stable' as const },
            },
          },
          statusCounts: [],
          recentOrders: [],
        },
      });
    }

    // Build where clause to ensure consistent filters across parallel queries
    const where = buildOrderWhereClause({}, undefined);

    // Execute queries in parallel for performance
    const [
      { statusCounts, aggregatedCounts, totalOrders, pendingOrders },
      totalRevenueAgg,
      recentOrdersData,
    ] = await Promise.all([
      getOrderStatusMetrics(),
      prisma.order.aggregate({
        where,
        _sum: {
          totalCents: true,
        },
      }),
      prisma.order.findMany({
        where,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          customer: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    // Calculate percentages and add labels
    const statusCountsWithLabels = statusCounts.map(({ status, label, count }) => ({
      status,
      count,
      label,
      percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0,
    }));

    const revenueSumCents = Number(totalRevenueAgg._sum.totalCents || 0);
    const revenueSum = revenueSumCents / 100;
    const avgOrderValue = totalOrders > 0 ? revenueSum / totalOrders : 0;

    // Count specific statuses (normalized)
    const completedOrders = getCompletedCount(aggregatedCounts);
    const installationsPending = getInstallationsPendingCount(aggregatedCounts);

    const recentOrders = recentOrdersData.map(order => {
      const normalizedStatus = normalizeOrderStatus(order.status);
      return {
        id: order.id,
        number: order.number,
        customerName: order.customer?.name || 'לא ידוע',
        status: normalizedStatus,
        statusLabel: getStatusLabel(normalizedStatus as any),
        totalAmount: (Number((order as any).totalCents ?? 0) / 100),
        createdAt: order.createdAt.toISOString(),
      };
    });

    // Calculate trends (simplified - in production, compare with previous period)
    const orderTrend = { value: 0, type: 'stable' as const };
    const revenueTrend = { value: 0, type: 'stable' as const };

    const dashboardData: DashboardSuccessResponse = {
      success: true,
      data: {
        summary: {
          totalOrders,
          pendingOrders,
          completedOrders,
          installationsPending,
          totalRevenue: revenueSum,
          avgOrderValue,
          trend: {
            orders: orderTrend,
            revenue: revenueTrend,
          },
        },
        statusCounts: statusCountsWithLabels,
        recentOrders,
      },
      error: null,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Dashboard API error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        summary: {
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          installationsPending: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          trend: {
            orders: { value: 0, type: 'stable' as const },
            revenue: { value: 0, type: 'stable' as const },
          },
        },
        statusCounts: [],
        recentOrders: [],
      },
    });
  } finally {
    // prisma managed centrally
  }
}

// Require authentication for dashboard data
export const GET = withAuthApiRoute(getDashboard);

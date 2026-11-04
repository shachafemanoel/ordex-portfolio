import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardMetrics } from '@/types/dashboard';

const getDashboardMetricsMock = vi.fn();
const analyzeDashboardMock = vi.fn();
const verifySessionMock = vi.fn();

vi.mock('@/lib/db/queries/dashboard-metrics', () => ({
  getDashboardMetrics: getDashboardMetricsMock,
}));

vi.mock('@/lib/ai/dashboard-analyzer', () => ({
  analyzeDashboard: analyzeDashboardMock,
}));

vi.mock('@/lib/auth/verifySession', () => ({
  verifySessionFromRequest: verifySessionMock,
}));

import { GET } from '@/app/api/ai/analyze-dashboard/route';

const metrics: DashboardMetrics = {
  totalRevenue: 123,
  totalOrders: 3,
  avgOrderValue: 41,
  activeCustomers: 2,
  ordersByStatus: { SUPPLIED: 1, DRAFT: 2 },
  productsInStock: 4,
  productsOutOfStock: 1,
  productsLowStock: 1,
  openPurchaseOrders: 1,
  purchaseOrdersValue: 12,
  overduePurchaseOrders: 0,
  onTimeDeliveryRate: 90,
  avgOrderProcessingTime: 2,
  ordersWaitingForStock: 0,
  ordersWaitingForInstallation: 1,
  dso: 10,
  pendingPayments: 1,
  pendingPaymentsValue: 5,
  recentEvents: [],
};

const analysis = {
  timestamp: new Date('2024-05-15T00:00:00Z'),
  summary: 'All systems nominal',
  overallHealth: 'good' as const,
  insights: [{ id: '1', priority: 'critical' as const, category: 'inventory' as const }],
  metrics: { totalRevenue: 123, ordersCount: 3, criticalIssues: 1, opportunitiesFound: 0 },
};

describe('GET /api/ai/analyze-dashboard', () => {
  beforeEach(() => {
    getDashboardMetricsMock.mockResolvedValue(metrics);
    analyzeDashboardMock.mockResolvedValue(analysis);
    verifySessionMock.mockResolvedValue({ user: { id: 'user-1', role: 'ADMIN' } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns AI analysis response with refreshed metrics', async () => {
    const request = new NextRequest('http://localhost/api/ai/analyze-dashboard?forceRefresh=true');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDashboardMetricsMock).toHaveBeenCalledTimes(1);
    expect(analyzeDashboardMock).toHaveBeenCalledWith(metrics, true);
    expect(body.success).toBe(true);
    expect(body.data.analysis.summary).toBe(analysis.summary);
    expect(body.data.metadata.metricsSnapshot.totalRevenue).toBe(metrics.totalRevenue);
  });
});

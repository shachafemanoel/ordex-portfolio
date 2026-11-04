import { describe, expect, it, vi, beforeEach } from 'vitest';

const analyzeWithStructuredOutput = vi.fn();
const isAvailable = vi.fn(() => true);

vi.mock('@/lib/ai/gemini-client', () => ({
  geminiClient: {
    isAvailable,
    analyzeWithStructuredOutput,
  },
  SchemaType: {
    OBJECT: 'object',
    ARRAY: 'array',
    STRING: 'string',
    NUMBER: 'number',
  },
  getFallbackAnalysis: vi.fn(() => ({
    timestamp: new Date(),
    summary: 'fallback',
    overallHealth: 'warning',
    insights: [],
    metrics: { totalRevenue: 0, ordersCount: 0, criticalIssues: 0, opportunitiesFound: 0 },
  })),
}));

vi.mock('@/lib/redis', () => ({
  redis: null,
}));

const sampleMetrics = {
  totalRevenue: 100000,
  totalOrders: 120,
  avgOrderValue: 833,
  activeCustomers: 54,
  ordersByStatus: {
    PENDING_INFO: 5,
    IN_PROGRESS: 10,
    COMPLETED: 90,
  },
  productsInStock: 50,
  productsOutOfStock: 3,
  productsLowStock: 4,
  openPurchaseOrders: 2,
  purchaseOrdersValue: 20000,
  overduePurchaseOrders: 1,
  onTimeDeliveryRate: 92,
  avgOrderProcessingTime: 3,
  ordersWaitingForStock: 4,
  ordersWaitingForInstallation: 6,
  dso: 60,
  pendingPayments: 2,
  pendingPaymentsValue: 5000,
  recentEvents: [
    { type: 'order_created', description: 'Order 1', timestamp: new Date() },
  ],
};

describe('analyzeDashboard', () => {
  beforeEach(() => {
    analyzeWithStructuredOutput.mockReset();
    isAvailable.mockReturnValue(true);
  });

  it('retries with compact prompt when the first attempt times out', async () => {
    analyzeWithStructuredOutput
      .mockRejectedValueOnce(new Error('Gemini API request timeout'))
      .mockResolvedValueOnce({
        result: {
          summary: 'ok',
          overallHealth: 'good',
          insights: [],
          metrics: { totalRevenue: 1, ordersCount: 1, criticalIssues: 0, opportunitiesFound: 0 },
        },
        usage: { totalTokens: 1, promptTokens: 1, completionTokens: 0 },
      });

    const { analyzeDashboard } = await import('@/lib/ai/dashboard-analyzer');
    const response = await analyzeDashboard(sampleMetrics, true);

    expect(analyzeWithStructuredOutput).toHaveBeenCalledTimes(2);
    expect(response.summary).toBe('ok');
  });

  it('returns fallback analysis when Gemini is unavailable', async () => {
    isAvailable.mockReturnValue(false);
    const { analyzeDashboard } = await import('@/lib/ai/dashboard-analyzer');
    const response = await analyzeDashboard(sampleMetrics, true);
    expect(response.overallHealth).toBe('warning');
  });
});

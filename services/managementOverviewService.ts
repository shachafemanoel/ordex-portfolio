export interface ManagementOverviewData {
  stats: {
    customers: {
      activeThisMonth: number;
      topByValue: Array<{
        id: string;
        name: string;
        ordersCount: number;
        clv: number;
      }>;
      recent: Array<{
        id: string;
        name: string;
        phone?: string | null;
        createdAt: string;
      }>;
    };
    orders: {
      total: number;
      dsoDays: number | null;
      cycleTime: {
        medianDays: number | null;
        averageDays: number | null;
        sampleSize: number;
      };
      onTimeDelivery: {
        rate: number | null;
        totalEvaluated: number;
        lateCount: number;
      };
      statusBreakdown: Array<{
        status: string;
        count: number;
      }>;
      trend: Array<{
        date: string;
        count: number;
      }>;
    };
    products: {
      totalSkus: number;
      lowStock: Array<{
        id: string;
        name: string;
        code: string;
        stock: number;
        reorderLevel: number;
      }>;
      topSelling: Array<{
        sku: string;
        name: string;
        units: number;
        revenue: number;
      }>;
    };
    team: {
      totalUsers: number;
      topPerformers: Array<{
        userId: string;
        name: string;
        role: string;
        ordersHandled: number;
        revenueCents: number;
      }>;
      roles: Array<{
        role: string;
        count: number;
      }>;
    };
  };
}

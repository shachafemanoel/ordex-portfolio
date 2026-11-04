export enum InsightPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface AIAction {
  id: string;
  label: string;
  description?: string;
  type: string;
  href?: string;
  icon?: string;
  payload?: Record<string, unknown>;
}

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  priority: InsightPriority;
  impact: string;
  category: string;
  actions: AIAction[];
}

export interface DashboardAnalysis {
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  timestamp: string;
  summary: string;
  metrics: {
    totalRevenue: number;
    ordersCount: number;
    criticalIssues: number;
    opportunitiesFound: number;
  };
  insights: AIInsight[];
}

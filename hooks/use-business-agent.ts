'use client';

/**
 * Business Agent Hook
 * הוק לשימוש בסוכן העסקי החכם
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface BusinessInsight {
  id: string;
  severity: 'critical' | 'warning' | 'opportunity' | 'info';
  category: string;
  title: string;
  description: string;
  impact?: string;
  suggestedActions: SuggestedAction[];
  relatedEntityIds?: string[];
}

export interface SuggestedAction {
  id: string;
  label: string;
  type: string;
  params: Record<string, unknown>;
  requiresConfirmation: boolean;
  estimatedImpact?: string;
}

export interface AutomationSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  affectedCount: number;
  steps: Array<{
    order: number;
    action: string;
    description: string;
    params: Record<string, unknown>;
  }>;
}

export interface BusinessKPIs {
  ordersAtRisk: number;
  stuckOrders: number;
  overduePayments: number;
  pendingInstallations: number;
  todayRevenue: number;
  weeklyTrend: 'up' | 'down' | 'stable';
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: string;
  priority: string;
  label: string;
  orderNumber?: string;
  customerName?: string;
  city: string;
  status?: string;
  tooltip: string;
  actionable: boolean;
}

export interface ExecutionResult {
  actionId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  message: string;
  affectedIds: string[];
}

// ============================================================================
// Hook
// ============================================================================

interface UseBusinessAgentOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useBusinessAgent(options: UseBusinessAgentOptions = {}) {
  const { autoRefresh = false, refreshInterval = 60000 } = options;

  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [automations, setAutomations] = useState<AutomationSuggestion[]>([]);
  const [kpis, setKpis] = useState<BusinessKPIs | null>(null);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch business snapshot
  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/agent');
      if (!res.ok) throw new Error('Failed to fetch snapshot');

      const data = await res.json();
      setInsights(data.data?.insights || []);
      setKpis(data.data?.kpis || null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch automations
  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/agent/automations');
      if (!res.ok) return;

      const data = await res.json();
      setAutomations(data.data?.suggestions || []);
    } catch (err) {
      console.error('Failed to fetch automations:', err);
    }
  }, []);

  // Fetch map markers
  const fetchMapMarkers = useCallback(async (view?: string) => {
    try {
      const url = view
        ? `/api/ai/agent/map-intel?view=${view}`
        : '/api/ai/agent/map-intel';
      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      setMapMarkers(data.data?.markers || []);
    } catch (err) {
      console.error('Failed to fetch map markers:', err);
    }
  }, []);

  // Execute action
  const executeAction = useCallback(
    async (action: SuggestedAction, dryRun = false): Promise<ExecutionResult> => {
      try {
        const res = await fetch('/api/ai/agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, dryRun }),
        });

        const data = await res.json();

        if (!res.ok) {
          return {
            actionId: action.id,
            status: 'failed',
            message: data.error || 'Execution failed',
            affectedIds: [],
          };
        }

        // Refresh data after successful action
        if (!dryRun) {
          await fetchSnapshot();
        }

        return data.data?.result || {
          actionId: action.id,
          status: 'completed',
          message: 'Action executed',
          affectedIds: [],
        };
      } catch (err) {
        return {
          actionId: action.id,
          status: 'failed',
          message: err instanceof Error ? err.message : 'Unknown error',
          affectedIds: [],
        };
      }
    },
    [fetchSnapshot]
  );

  // Execute automation
  const executeAutomation = useCallback(
    async (automation: AutomationSuggestion): Promise<ExecutionResult[]> => {
      const results: ExecutionResult[] = [];

      for (const step of automation.steps) {
        const action: SuggestedAction = {
          id: `${automation.id}-step-${step.order}`,
          label: step.description,
          type: step.action,
          params: step.params,
          requiresConfirmation: false,
        };

        const result = await executeAction(action);
        results.push(result);

        if (result.status === 'failed') {
          break;
        }
      }

      return results;
    },
    [executeAction]
  );

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([fetchSnapshot(), fetchAutomations()]);
  }, [fetchSnapshot, fetchAutomations]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refresh]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Computed values
  const criticalInsights = insights.filter((i) => i.severity === 'critical');
  const warningInsights = insights.filter((i) => i.severity === 'warning');
  const opportunityInsights = insights.filter((i) => i.severity === 'opportunity');

  const hasUrgentItems = criticalInsights.length > 0;
  const totalActionableItems = insights.reduce(
    (sum, i) => sum + i.suggestedActions.length,
    0
  );

  return {
    // Data
    insights,
    automations,
    kpis,
    mapMarkers,

    // Computed
    criticalInsights,
    warningInsights,
    opportunityInsights,
    hasUrgentItems,
    totalActionableItems,

    // State
    loading,
    error,
    lastUpdated,

    // Actions
    refresh,
    fetchSnapshot,
    fetchAutomations,
    fetchMapMarkers,
    executeAction,
    executeAutomation,
  };
}

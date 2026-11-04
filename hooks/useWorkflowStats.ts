'use client';

import { useQuery } from '@tanstack/react-query';

export interface WorkflowStats {
  payment_needed: number;
  purchasing_needed: number;
  scheduling_needed: number;
  execution_needed: number;
}

async function fetchStats(): Promise<WorkflowStats> {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) {
    throw new Error('Failed to fetch stats');
  }
  return res.json();
}

export function useWorkflowStats() {
  return useQuery({
    queryKey: ['workflowStats'],
    queryFn: fetchStats,
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 10000,
  });
}

'use client';

import apiClient from '@/lib/apiClient';
import { useMutation, useQuery } from '@tanstack/react-query';

export interface InstallationCandidateFilters {
  dateFrom?: string;
  dateTo?: string;
  city?: string;
  userId?: string;
  statuses?: string[];
  query?: string;
}

export interface AgentInstallationCandidate {
  id: string;
  orderNumber: string;
  city: string | null;
  installationDate?: string | null;
  [key: string]: unknown;
}

interface CandidatesResponse {
  filters_applied: InstallationCandidateFilters;
  orders: AgentInstallationCandidate[];
}

export interface PlanResult {
  plannedOrders: Array<{
    date: string;
    orderIds: string[];
    technicianId?: string;
    routeOrder?: string[];
  }>;
  unassignedOrderIds: string[];
}

export function useInstallationPlanner(initialFilters?: InstallationCandidateFilters) {
  const fetchCandidates = async (filters: InstallationCandidateFilters) => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    if (filters.city) params.append('city', filters.city);
    if (filters.userId) params.append('user_id', filters.userId);
    if (filters.statuses?.length) {
      params.append('statuses', filters.statuses.join(','));
    }
    if (filters.query) {
      params.append('q', filters.query);
    }

    const response = await apiClient.get<CandidatesResponse>(
      `/api/agents/installations/candidates?${params.toString()}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch candidates');
    }

    return response.data;
  };

  const generatePlan = async (filters: InstallationCandidateFilters) => {
    const response = await apiClient.post<PlanResult>('/api/agents/installations/plan', filters);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to generate plan');
    }

    return response.data;
  };

  const useCandidates = (filters: InstallationCandidateFilters) => {
    return useQuery({
      queryKey: ['installation-candidates', filters],
      queryFn: () => fetchCandidates(filters),
      staleTime: 60 * 1000, // 1 minute
    });
  };

  const usePlanMutation = () => {
    return useMutation({
      mutationFn: generatePlan,
    });
  };

  return {
    useCandidates,
    usePlanMutation,
  };
}

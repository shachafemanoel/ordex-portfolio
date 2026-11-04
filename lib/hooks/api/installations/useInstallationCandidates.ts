'use client';

import { apiClient } from '@/lib/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface InstallationCandidateFilters {
  dateFrom?: string;
  dateTo?: string;
  city?: string;
  userId?: string;
  statuses?: string[];
  query?: string;
}

export interface InstallationCandidatesResponse {
  orders: unknown[];
  filters_applied: InstallationCandidateFilters;
}

const buildQuery = (filters: InstallationCandidateFilters) => {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.city) params.set('city', filters.city);
  if (filters.userId) params.set('user_id', filters.userId);
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.query) params.set('q', filters.query);
  return params.toString();
};

export function useInstallationCandidates(filters: InstallationCandidateFilters) {
  return useQuery({
    queryKey: ['installations', 'candidates', filters],
    queryFn: async () => {
      const query = buildQuery(filters);
      const response = await apiClient.get<InstallationCandidatesResponse>(
        `/api/agents/installations/candidates${query ? `?${query}` : ''}`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load installations');
      }
      return response.data;
    },
    staleTime: 20_000,
  });
}

interface ScheduleInstallationPayload {
  scheduledAt: string;
  installerName?: string | null;
  installerNotes?: string | null;
  installerId?: string | null;
  calendarSync?: boolean;
  address?: {
    city: string;
    street: string;
    number: string;
    floor?: string | null;
    apartment?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
}

export function useScheduleInstallationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: ScheduleInstallationPayload;
    }) => {
      const response = await apiClient.patch(`/api/orders/${orderId}/schedule`, payload);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to schedule installation');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installations', 'candidates'] });
    },
  });
}

export function useCalendarEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.post(`/api/agents/installations/${orderId}/calendar-event`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create calendar event');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installations', 'candidates'] });
    },
  });
}

export function useReminderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, channel }: { orderId: string; channel: 'sms' | 'whatsapp' }) => {
      const response = await apiClient.post(`/api/orders/${orderId}/reminder`, { channel });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to send reminder');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installations', 'candidates'] });
    },
  });
}

export function useBulkReminderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetDate: string) => {
      const response = await apiClient.post('/api/agents/reminders', {
        target_date: targetDate,
        type: 'installation',
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to send reminders');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installations', 'candidates'] });
    },
  });
}

export function useInstallationExport(filters: InstallationCandidateFilters) {
  return () => {
    const query = buildQuery(filters);
    const url = `/api/agents/installations/export?format=csv${query ? `&${query}` : ''}`;
    window.open(url, '_blank');
  };
}

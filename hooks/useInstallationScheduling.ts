'use client';

import apiClient from '@/lib/apiClient';
import type { ApiResponse } from '@/lib/types';
import { useMutation, useQuery } from '@tanstack/react-query';

interface RecommendSlotsPayload {
  technicianId?: string;
  dateRange?: { from: string; to: string };
}

interface ApplySlotPayload {
  technicianId?: string | null;
  date: string;
  start: string;
  end: string;
}

export function useInstallationSummary(days: number = 14) {
  return useQuery({
    queryKey: ['installation-summary', days],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Record<string, string[]>>>(
        `/api/installations/city-summary?days=${days}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'נכשל בשליפת סיכום התקנות');
      }

      return response.data;
    },
  });
}

export function useInstallationScheduling(orderId: string) {
  const recommendSlots = useMutation({
    mutationFn: async (payload: RecommendSlotsPayload) => {
      const response = await apiClient.post<ApiResponse<unknown>>(
        '/api/ai/scheduling/recommend-slots',
        { orderId, ...payload }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'נכשל בשליפת הצעות התקנה');
      }

      return response.data;
    },
  });

  const applySlot = useMutation({
    mutationFn: async (payload: ApplySlotPayload) => {
      const response = await apiClient.post<ApiResponse<any>>('/api/ai/scheduling/apply-slot', {
        orderId,
        ...payload,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'נכשל בשמירת חלון ההתקנה');
      }

      return response.data;
    },
  });

  return { recommendSlots, applySlot };
}

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useOpsActions() {
  const [loading, setLoading] = useState(false);

  const sendToSupplier = useCallback(
    async (orderId: string, itemId: string, estimatedSupplyAt: Date) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/orders/${orderId}/items/${itemId}/send-to-supplier`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              estimatedSupplyAt: estimatedSupplyAt.toISOString(),
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to send item to supplier');
        }

        const data = await response.json();
        toast.success('הפריט נשלח לספק בהצלחה');
        return data;
      } catch (error) {
        console.error('Failed to send to supplier:', error);
        toast.error('שגיאה בשליחה לספק');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const markUrgent = useCallback(async (orderId: string, urgent: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urgent,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update order');
      }

      const data = await response.json();
      toast.success(urgent ? 'ההזמנה סומנה כדחופה' : 'דחיפות בוטלה');
      return data;
    } catch (error) {
      console.error('Failed to mark urgent:', error);
      toast.error('שגיאה בעדכון ההזמנה');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getOpsState = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/ops-state`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch ops state');
      }

      const data = await response.json();
      return data.data.opsState;
    } catch (error) {
      console.error('Failed to get ops state:', error);
      toast.error('שגיאה בטעינת מצב תפעולי');
      throw error;
    }
  }, []);

  return {
    sendToSupplier,
    markUrgent,
    getOpsState,
    loading,
  };
}

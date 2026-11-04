import { useState, useEffect, useCallback } from 'react';

export interface OrderTask {
  id: string;
  orderId: string;
  type: string;
  title: string;
  color: string;
  status: string;
  dueAt: string | null;
  checklist: any[];
  meta: any;
  note: string | null;
}

export function useOrderTask(orderId: string) {
  const [task, setTask] = useState<OrderTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/orders/${orderId}/tasks/active`);
      const data = await res.json();
      if (data.success) {
        setTask(data.activeTask);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const updateChecklist = async (patches: { itemId: string; checked: boolean }[]) => {
    if (!task) return;
    try {
      setIsUpdating(true);
      const res = await fetch(`/api/orders/${orderId}/tasks/active/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, patches }),
      });
      const data = await res.json();
      if (data.success) {
        setTask(data.task);
      }
    } catch (err: any) {
      console.error('Failed to update checklist:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const completeTask = async (options?: { actionChoice?: string; override?: { enabled: boolean; reason: string } }) => {
    if (!task) return;
    try {
      setIsUpdating(true);
      const res = await fetch(`/api/orders/${orderId}/tasks/active/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, ...options }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.blocked) {
          return { success: false, blocked: true, missingItems: data.missingItems };
        }
        setTask(data.nextTask);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    task,
    isLoading,
    isUpdating,
    error,
    updateChecklist,
    completeTask,
    refresh: fetchTask,
  };
}

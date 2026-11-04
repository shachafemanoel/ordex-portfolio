import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { ActionDefinition } from '@/lib/actions/registry';
import { friendlyMessageFromError } from '@/lib/ui/apiErrors';

interface UseActionRunnerProps<TEntity> {
  entityType: string;
  entityId: string;
  onSuccess?: (actionId: string, result: any) => void;
}

export function useActionRunner<TEntity>({ entityType, entityId, onSuccess }: UseActionRunnerProps<TEntity>) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const runAction = async (action: ActionDefinition<TEntity>, payload: any) => {
    setIsLoading(true);
    try {
      // Validate payload if schema exists
      if (action.payloadSchema) {
        action.payloadSchema.parse(payload);
      }

      const method = action.api?.method || 'POST';
      const url = `/api/${entityType}/${entityId}/actions/${action.id}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch {
           errorData = { message: `Action ${action.id} failed` };
        }

        throw new Error(errorData.message || errorData.error?.message || `Action ${action.id} failed`);
      }

      const result = await res.json();

      toast.success(`${action.label} בוצע בהצלחה`);

      if (onSuccess) {
        onSuccess(action.id, result);
      }

      router.refresh();
      return result;
    } catch (error: any) {
      console.error(`Action ${action.id} error:`, error);
      toast.error('שגיאה בביצוע פעולה', friendlyMessageFromError(error));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { runAction, isLoading };
}

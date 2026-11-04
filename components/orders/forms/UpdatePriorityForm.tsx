'use client';

import apiClient from '@/lib/apiClient';

import { useState } from 'react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

interface UpdatePriorityFormProps {
  orderId: string;
  initialPriority?: Priority;
  onUpdated?: () => void;
}

export function UpdatePriorityForm({ orderId, initialPriority = 'MEDIUM', onUpdated }: UpdatePriorityFormProps) {
  const [priority, setPriority] = useState<Priority>(initialPriority);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient(`/api/orders/${orderId}/priority`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        const msg = payload?.error?.message || 'שגיאה בעדכון עדיפות';
        throw new Error(msg);
      }
      try { toast.success('העדיפות עודכנה', 'עודכנה עדיפות ההזמנה בהצלחה'); } catch {}
      if (typeof onUpdated === 'function') onUpdated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בעדכון עדיפות';
      try { toast.error('שגיאה', msg); } catch {}
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={priority}
        onValueChange={(v) => setPriority(v as Priority)}
        options={[
          { value: 'LOW', label: 'נמוכה' },
          { value: 'MEDIUM', label: 'בינונית' },
          { value: 'HIGH', label: 'גבוהה' },
        ]}
      />
      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? 'שומר...' : 'שמור עדיפות'}
      </Button>
    </div>
  );
}


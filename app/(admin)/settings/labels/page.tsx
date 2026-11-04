'use client';

import { DashboardPage } from '@/components/layout/templates/DashboardPage';
import { Badge } from '@/components/ui/Badge';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/apiClient';
import { useToast } from '@/components/ui/ToastProvider';

interface UILabel {
  id: string;
  key: string;
  value: string;
  locale: string;
  isActive: boolean;
}

const labelSchema = z.object({
  key: z.string().min(1), // Read-only in edit usually
  value: z.string().min(1, 'Value is required'),
  isActive: z.boolean().default(true),
});

type LabelForm = z.infer<typeof labelSchema>;

export default function LabelsPage() {
  const [items, setItems] = useState<UILabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UILabel | null>(null);
  const { success, error } = useToast();

  const form = useForm<LabelForm>({
    resolver: zodResolver(labelSchema),
    defaultValues: {
      isActive: true,
    },
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiClient('/api/admin/labels');
      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
      }
    } catch (err) {
      error('Failed to load labels');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const onSubmit = async (data: LabelForm) => {
    try {
      const url = editingItem
        ? `/api/admin/labels/${editingItem.id}`
        : '/api/admin/labels';
      
      const res = await apiClient(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to save');

      success(editingItem ? 'Label updated' : 'Label created');
      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      error('Error saving label');
    }
  };

  const openModal = (item?: UILabel) => {
    setEditingItem(item || null);
    form.reset(
      item || {
        key: '',
        value: '',
        isActive: true,
      }
    );
    setIsModalOpen(true);
  };

  const columns = [
    { key: 'key', label: 'מפתח (Key)', title: 'מפתח' },
    { key: 'value', label: 'ערך (Hebrew)', title: 'ערך' },
    {
      key: 'isActive',
      label: 'סטטוס',
      title: 'סטטוס',
      render: (val: boolean) => <Badge variant={val ? 'success' : 'secondary'}>{val ? 'פעיל' : 'לא פעיל'}</Badge>
    },
    {
      key: 'actions',
      label: 'פעולות',
      title: 'פעולות',
      render: (_: any, item: UILabel) => (
        <Button size="sm" variant="outline" onClick={() => openModal(item)}>
          ערוך
        </Button>
      ),
    },
  ];

  return (
    <DashboardPage title="תוויות מערכת" actions={<Button onClick={() => openModal()}>+ תווית חדשה</Button>}>

      <Card className="p-6">
        <DataTable columns={columns} data={items} loading={loading} />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'עריכת תווית' : 'תווית חדשה'}
        className="max-w-md"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
          <FormField label="מפתח (Key)" error={form.formState.errors.key?.message}>
            <Input 
              {...form.register('key')}
              disabled={!!editingItem} // Key is read-only when editing
              className={editingItem ? 'bg-[var(--surface-muted)]' : ''}
            />
            {editingItem && <p className="text-xs text-[var(--text-secondary)]">לא ניתן לשנות מפתח</p>}
          </FormField>

          <FormField label="ערך (עברית)" error={form.formState.errors.value?.message}>
            <Input {...form.register('value')} />
          </FormField>

          <FormField label="סטטוס">
            <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Checkbox {...form.register('isActive')} />
              <span>פעיל</span>
            </label>
          </FormField>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              ביטול
            </Button>
            <Button type="submit">שמור</Button>
          </div>
        </form>
      </Modal>
    </DashboardPage>
  );
}

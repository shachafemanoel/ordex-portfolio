'use client';

import { DashboardPage } from '@/components/layout/templates/DashboardPage';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/apiClient';
import { useToast } from '@/components/ui/ToastProvider';

interface HelpSnippet {
  id: string;
  key: string;
  title: string;
  body: string;
  context: string;
  isActive: boolean;
}

const helpSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  context: z.string().min(1, 'Context is required'),
  isActive: z.boolean().default(true),
});

type HelpForm = z.infer<typeof helpSchema>;

export default function HelpPage() {
  const [items, setItems] = useState<HelpSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HelpSnippet | null>(null);
  const { success, error } = useToast();

  const form = useForm<HelpForm>({
    resolver: zodResolver(helpSchema),
    defaultValues: {
      isActive: true,
    },
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiClient('/api/admin/help');
      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
      }
    } catch (err) {
      error('Failed to load help snippets');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const onSubmit = async (data: HelpForm) => {
    try {
      const url = editingItem
        ? `/api/admin/help/${editingItem.id}`
        : '/api/admin/help';

      const res = await apiClient(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to save');

      success(editingItem ? 'Snippet updated' : 'Snippet created');
      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      error('Error saving snippet');
    }
  };

  const openModal = (item?: HelpSnippet) => {
    setEditingItem(item || null);
    form.reset(
      item || {
        key: '',
        title: '',
        body: '',
        context: 'orders',
        isActive: true,
      }
    );
    setIsModalOpen(true);
  };

  const columns = [
    { key: 'key', label: 'מפתח (Key)', title: 'מפתח' },
    { key: 'title', label: 'כותרת', title: 'כותרת' },
    { key: 'context', label: 'הקשר', title: 'הקשר' },
    {
      key: 'body',
      label: 'תוכן',
      title: 'תוכן',
      render: (val: string) => <span className="truncate max-w-xs block">{val}</span>
    },
    {
      key: 'actions',
      label: 'פעולות',
      title: 'פעולות',
      render: (_: any, item: HelpSnippet) => (
        <Button size="sm" variant="outline" onClick={() => openModal(item)}>
          ערוך
        </Button>
      ),
    },
  ];

  return (
    <DashboardPage title="קטעי עזרה" actions={<Button onClick={() => openModal()}>+ קטע חדש</Button>}>

      <Card className="p-6">
        <DataTable columns={columns} data={items} loading={loading} />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'עריכת עזרה' : 'קטע עזרה חדש'}
        className="max-w-xl"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
          <FormField label="מפתח ייחודי (Key)" error={form.formState.errors.key?.message}>
            <Input {...form.register('key')} placeholder="e.g. ops.waiting.explain" />
          </FormField>

          <FormField label="כותרת" error={form.formState.errors.title?.message}>
            <Input {...form.register('title')} />
          </FormField>

          <FormField label="תוכן" error={form.formState.errors.body?.message}>
            <Textarea {...form.register('body')} className="min-h-[140px]" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="הקשר (Context)" error={form.formState.errors.context?.message}>
              <Input {...form.register('context')} placeholder="e.g. orders, catalog" />
            </FormField>

            <FormField label="סטטוס">
              <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Checkbox {...form.register('isActive')} />
                <span>פעיל</span>
              </label>
            </FormField>
          </div>

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

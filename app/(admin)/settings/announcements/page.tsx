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
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/apiClient';
import { useToast } from '@/components/ui/ToastProvider';
import { AnnouncementAudience } from '@prisma/client';
import { StatusChip } from '@/components/ui/StatusChip';

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  audience: z.nativeEnum(AnnouncementAudience),
  startAt: z.string().min(1, 'Start date is required'),
  endAt: z.string().min(1, 'End date is required'),
  isActive: z.boolean().default(true),
});

type AnnouncementForm = z.infer<typeof announcementSchema>;

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const { success, error } = useToast();

  const form = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      audience: 'ALL',
      isActive: true,
    },
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiClient('/api/admin/announcements');
      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
      }
    } catch (err) {
      error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const onSubmit = async (data: AnnouncementForm) => {
    try {
      const url = editingItem
        ? `/api/admin/announcements/${editingItem.id}`
        : '/api/admin/announcements';

      const res = await apiClient(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to save');

      success(editingItem ? 'Announcement updated' : 'Announcement created');
      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      error('Error saving announcement');
    }
  };

  const openModal = (item?: Announcement) => {
    setEditingItem(item || null);
    form.reset(
      item
        ? {
            ...item,
            startAt: new Date(item.startAt).toISOString().slice(0, 16),
            endAt: new Date(item.endAt).toISOString().slice(0, 16),
          }
        : {
            audience: 'ALL',
            isActive: true,
            title: '',
            body: '',
            startAt: new Date().toISOString().slice(0, 16),
            endAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
          }
    );
    setIsModalOpen(true);
  };

  const columns = [
    { key: 'title', label: 'כותרת', title: 'כותרת' },
    {
      key: 'audience',
      label: 'קהל יעד',
      title: 'קהל יעד',
      render: (val: string) => <StatusChip status={val} variant="order" />
    },
    {
      key: 'isActive',
      label: 'סטטוס',
      title: 'סטטוס',
      render: (val: boolean) => <Badge variant={val ? 'success' : 'secondary'}>{val ? 'פעיל' : 'לא פעיל'}</Badge>
    },
    {
      key: 'dates',
      label: 'תאריכים',
      title: 'תאריכים',
      render: (_: any, item: Announcement) => (
        <div className="text-xs">
          <div>{new Date(item.startAt).toLocaleDateString()}</div>
          <div className="text-gray-400">עד {new Date(item.endAt).toLocaleDateString()}</div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'פעולות',
      title: 'פעולות',
      render: (_: any, item: Announcement) => (
        <Button size="sm" variant="outline" onClick={() => openModal(item)}>
          ערוך
        </Button>
      ),
    },
  ];

  return (
    <DashboardPage
      title="הודעות מערכת"
      actions={<Button onClick={() => openModal()}>+ הודעה חדשה</Button>}
    >

      <Card className="p-6">
        <DataTable columns={columns} data={items} loading={loading} />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'עריכת הודעה' : 'הודעה חדשה'}
        className="max-w-xl"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
          <FormField label="כותרת" error={form.formState.errors.title?.message}>
            <Input {...form.register('title')} />
          </FormField>

          <FormField label="תוכן" error={form.formState.errors.body?.message}>
            <Textarea {...form.register('body')} className="min-h-[140px]" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="קהל יעד">
              <Select {...form.register('audience')}>
                <option value="ALL">כולם</option>
                <option value="OPS">תפעול</option>
                <option value="ADMIN">מנהלים</option>
              </Select>
            </FormField>

            <FormField label="סטטוס">
              <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Checkbox {...form.register('isActive')} />
                <span>פעיל</span>
              </label>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="תאריך התחלה" error={form.formState.errors.startAt?.message}>
              <Input type="datetime-local" {...form.register('startAt')} />
            </FormField>
            <FormField label="תאריך סיום" error={form.formState.errors.endAt?.message}>
              <Input type="datetime-local" {...form.register('endAt')} />
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

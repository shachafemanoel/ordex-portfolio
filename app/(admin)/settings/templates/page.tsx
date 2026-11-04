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
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/apiClient';
import { useToast } from '@/components/ui/ToastProvider';
import {
  MessageTemplateTarget,
  NotificationChannel,
  OperationalMessageKind,
} from '@prisma/client';
import { StatusChip } from '@/components/ui/StatusChip';

// Define the template shape based on API response
interface MessageTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  target: MessageTemplateTarget;
  content: string;
  subject?: string | null;
  operationalKind?: OperationalMessageKind | null;
  isActive: boolean;
  createdAt: string;
}

const templateSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    channel: z.nativeEnum(NotificationChannel),
    target: z.nativeEnum(MessageTemplateTarget),
    subject: z.string().max(998).optional(),
    bodyTemplate: z.string().min(1, 'Template body is required'),
    operationalKind: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.channel === NotificationChannel.EMAIL && !data.subject?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'נושא נדרש לערוץ אימייל',
        path: ['subject'],
      });
    }
  });

type TemplateForm = z.infer<typeof templateSchema>;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const { success, error } = useToast();

  const form = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      channel: 'WHATSAPP',
      target: 'CUSTOMER',
      isActive: true,
      subject: '',
      operationalKind: '',
    },
  });

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiClient('/api/admin/templates');
      if (res.ok) {
        const json = await res.json();
        const rows: MessageTemplate[] = (json.data || []).map((row: MessageTemplate) => ({
          ...row,
          content: row.content ?? (row as unknown as { bodyTemplate?: string }).bodyTemplate ?? '',
        }));
        setTemplates(rows);
      }
    } catch (err) {
      error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const onSubmit = async (data: TemplateForm) => {
    try {
      const url = editingTemplate
        ? `/api/admin/templates/${editingTemplate.id}`
        : '/api/admin/templates';

      const payload: Record<string, unknown> = {
        name: data.name,
        channel: data.channel,
        target: data.target,
        content: data.bodyTemplate,
        isActive: data.isActive,
      };
      if (data.subject?.trim()) payload.subject = data.subject.trim();
      if (editingTemplate) {
        payload.operationalKind = data.operationalKind?.trim()
          ? (data.operationalKind.trim() as OperationalMessageKind)
          : null;
      } else if (data.operationalKind?.trim()) {
        payload.operationalKind = data.operationalKind.trim() as OperationalMessageKind;
      }

      const res = await apiClient(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      success(editingTemplate ? 'Template updated' : 'Template created');
      setIsModalOpen(false);
      fetchTemplates();
    } catch (err) {
      error('Error saving template');
    }
  };

  const openModal = (tpl?: MessageTemplate) => {
    setEditingTemplate(tpl || null);
    form.reset(
      tpl
        ? {
            name: tpl.name,
            channel: tpl.channel,
            target: tpl.target,
            bodyTemplate: tpl.content,
            subject: tpl.subject ?? '',
            operationalKind: tpl.operationalKind ?? '',
            isActive: tpl.isActive,
          }
        : {
            channel: 'WHATSAPP',
            target: 'CUSTOMER',
            bodyTemplate: '',
            subject: '',
            operationalKind: '',
            isActive: true,
            name: '',
          }
    );
    setIsModalOpen(true);
  };

  const columns = [
    { key: 'name', label: 'שם', title: 'שם' },
    {
      key: 'channel',
      label: 'ערוץ',
      title: 'ערוץ',
      render: (val: string) => <StatusChip status={val} variant="order" />
    },
    {
      key: 'target',
      label: 'נמען',
      title: 'נמען',
      render: (val: string) => <StatusChip status={val} variant="installation" />
    },
    {
      key: 'content',
      label: 'תוכן',
      title: 'תוכן',
      render: (_: string, item: MessageTemplate) => (
        <span className="block max-w-xs truncate">{item.content}</span>
      ),
    },
    {
      key: 'subject',
      label: 'נושא',
      title: 'נושא',
      render: (val: string | null | undefined) => (
        <span className="block max-w-[140px] truncate text-xs">{val || '—'}</span>
      ),
    },
    {
      key: 'actions',
      label: 'פעולות',
      title: 'פעולות',
      render: (_: any, item: MessageTemplate) => (
        <Button size="sm" variant="outline" onClick={() => openModal(item)}>
          ערוך
        </Button>
      ),
    },
  ];

  const watchedBody = form.watch('bodyTemplate');

  return (
    <DashboardPage
      title="תבניות הודעה"
      actions={<Button onClick={() => openModal()}>+ תבנית חדשה</Button>}
    >

      <Card className="p-6">
        <DataTable columns={columns} data={templates} loading={loading} />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTemplate ? 'עריכת תבנית' : 'תבנית חדשה'}
        className="max-w-2xl"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="שם תבנית" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </FormField>

            <FormField label="סטטוס">
              <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Checkbox {...form.register('isActive')} />
                <span>פעיל</span>
              </label>
            </FormField>

            <FormField label="ערוץ">
              <Select {...form.register('channel')}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="EMAIL">Email</option>
              </Select>
            </FormField>

            <FormField label="נמען">
              <Select {...form.register('target')}>
                <option value="CUSTOMER">לקוח</option>
                <option value="SUPPLIER">ספק</option>
              </Select>
            </FormField>

            <FormField label="סוג תפעולי (אופציונלי)">
              <Select {...form.register('operationalKind')}>
                <option value="">—</option>
                <option value={OperationalMessageKind.MISSING_DETAILS_REQUEST}>
                  MISSING_DETAILS_REQUEST
                </option>
                <option value={OperationalMessageKind.ORDER_CONFIRMATION}>ORDER_CONFIRMATION</option>
                <option value={OperationalMessageKind.INSTALLATION_CONFIRMATION}>
                  INSTALLATION_CONFIRMATION
                </option>
                <option value={OperationalMessageKind.INSTALLATION_REMINDER}>
                  INSTALLATION_REMINDER
                </option>
                <option value={OperationalMessageKind.PURCHASE_REQUEST_SUPPLIER}>
                  PURCHASE_REQUEST_SUPPLIER
                </option>
                <option value={OperationalMessageKind.DELIVERY_SCHEDULE_COORDINATION}>
                  DELIVERY_SCHEDULE_COORDINATION (תיאום משלוח ללקוח)
                </option>
                <option value={OperationalMessageKind.DELIVERY_COURIER_ETA}>
                  DELIVERY_COURIER_ETA (וואטסאפ — שליח בדרך + ETA)
                </option>
                <option value={OperationalMessageKind.ORDER_ITEMS_SUPPLIER}>
                  ORDER_ITEMS_SUPPLIER (פריטים לספק מההזמנה)
                </option>
                <option value={OperationalMessageKind.CUSTOM}>CUSTOM</option>
              </Select>
            </FormField>
          </div>

          <FormField label="נושא (חובה לאימייל)" error={form.formState.errors.subject?.message}>
            <Input {...form.register('subject')} dir="auto" />
          </FormField>

          <FormField label="תוכן ההודעה" error={form.formState.errors.bodyTemplate?.message}>
            <Textarea {...form.register('bodyTemplate')} className="min-h-[180px]" dir="auto" />
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              משתנים זמינים:{' '}
              {
                '{{orderNumber}}, {{customerName}}, {{addressLine}}, {{deliveryScheduleSummary}}, {{etaSummary}}, {{estimatedArrival}}, {{etaMinutes}}, {{courierName}}, {{items}} …'
              }
            </p>
          </FormField>

          {/* Live Preview */}
          <div className="surface-subtle rounded-xl border border-[var(--border-default)] p-4">
            <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">תצוגה מקדימה (הדמיה)</h3>
            <div className="text-sm whitespace-pre-wrap dir-auto">
              {watchedBody
                ?.replace(/{{orderNumber}}/g, 'ORD-12345')
                .replace(/{{customerName}}/g, 'ישראל ישראלי')
                .replace(/{{city}}/g, 'תל אביב')
                .replace(/{{items}}/g, '- מקדחה (x1)\n- פטיש (x2)')
                || 'הקלד תוכן...'}
            </div>
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

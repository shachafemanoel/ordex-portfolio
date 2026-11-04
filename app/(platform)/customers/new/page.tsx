'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';

export default function NewCustomerPage() {
  const router = useRouter();
  const { t, direction } = useUITranslation();
  const { success: showSuccess, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    accountNotes: '',
    billingCity: '',
    billingStreet: '',
    billingNumber: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      showError(t('customers.new.validation.nameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        accountNotes: formData.accountNotes.trim() || null,
        billingAddress:
          formData.billingCity && formData.billingStreet && formData.billingNumber
            ? {
                city: formData.billingCity,
                street: formData.billingStreet,
                number: formData.billingNumber,
              }
            : undefined,
      };

      const response = await apiClient('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || t('customers.new.createError'));
      }

      showSuccess(t('customers.new.createSuccess'));
      router.push(`/customers/${data.data.id}`);
    } catch (error) {
      console.error('Failed to create customer:', error);
      showError(
        t('customers.new.createError'),
        error instanceof Error ? error.message : t('messages.tryAgain')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir={direction}>
      <PageHeader title={t('customers.new.title')} description={t('customers.new.description')} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-right">{t('customers.new.customerDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">
                {t('customers.new.customerNameLabel')}
              </label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('form.fullName')}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{t('form.email')}</label>
              <Input
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="example@mail.com"
                className="mt-2"
                type="email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{t('form.phone')}</label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="050-0000000"
                className="mt-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                {t('customers.new.accountNotesLabel')}
              </label>
              <Textarea
                value={formData.accountNotes}
                onChange={(e) => handleChange('accountNotes', e.target.value)}
                placeholder={t('customers.notesPlaceholder')}
                className="mt-2 min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-right">{t('customers.new.billingAddressOptional')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700">{t('form.city')}</label>
              <Input
                value={formData.billingCity}
                onChange={(e) => handleChange('billingCity', e.target.value)}
                placeholder={t('form.cityPlaceholder')}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{t('form.street')}</label>
              <Input
                value={formData.billingStreet}
                onChange={(e) => handleChange('billingStreet', e.target.value)}
                placeholder={t('form.streetPlaceholder')}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                {t('customers.new.numberLabel')}
              </label>
              <Input
                value={formData.billingNumber}
                onChange={(e) => handleChange('billingNumber', e.target.value)}
                placeholder="12"
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? t('customers.new.saving') : t('customers.new.save')}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/customers')}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
}

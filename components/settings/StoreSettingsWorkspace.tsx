'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Loader2, MapPin, RotateCcw, Save, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import {
  formatStoreAddress,
  resolveStoreRouteOrigin,
  STORE_SETTINGS_CURRENCIES,
  STORE_SETTINGS_LANGUAGES,
  STORE_SETTINGS_TIMEZONES,
  type StoreSettingsDto,
  type StoreSettingsSnapshot,
} from '@/lib/store-settings-schema';
import { ADMIN_CONSOLE_NAV_ENTRIES } from '@/lib/navigation/adminConsoleNav';
import { cn } from '@/lib/utils';
import { useRBAC } from '@/hooks/useRBAC';

const SETTINGS_QUERY_KEY = ['store-settings'];

const CURRENCY_OPTIONS = STORE_SETTINGS_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency === 'ILS' ? '₪ שקל' : currency === 'USD' ? '$ דולר' : '€ יורו',
}));

const LANGUAGE_OPTIONS = STORE_SETTINGS_LANGUAGES.map((language) => ({
  value: language,
  label: language === 'he' ? 'עברית' : 'English',
}));

const TIMEZONE_OPTIONS = STORE_SETTINGS_TIMEZONES.map((timezone) => ({
  value: timezone,
  label: timezone === 'Asia/Jerusalem' ? 'ישראל' : 'UTC',
}));

type StoreSettingsWorkspaceProps = {
  embedded?: boolean;
};

function toFormState(snapshot: StoreSettingsSnapshot): StoreSettingsDto {
  const { updatedAt, source, ...settings } = snapshot;
  void updatedAt;
  void source;
  return settings;
}

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) return 'טרם נשמר במסד הנתונים';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'טרם נשמר במסד הנתונים';

  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function SummaryItem({
  label,
  value,
  tone = 'default',
}: Readonly<{ label: string; value: string; tone?: 'default' | 'warning' | 'success' }>) {
  const toneClass =
    tone === 'warning'
      ? 'tone-warning'
      : tone === 'success'
        ? 'tone-success'
        : 'border border-subtle bg-surface-muted text-fg';

  return (
    <div className={cn('rounded-2xl border px-4 py-3', toneClass)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ShortcutLink({
  href,
  icon: Icon,
  title,
  description,
}: Readonly<{
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}>) {
  return (
    <Button asChild variant="outline" className="h-auto w-full justify-start px-4 py-3">
      <Link href={href} className="flex w-full items-start gap-3 text-right">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-highlight text-fg-muted">
          <Icon className="h-4 w-4" />
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-semibold text-fg">{title}</span>
          <span className="block text-xs font-medium text-fg-muted">{description}</span>
        </span>
      </Link>
    </Button>
  );
}

function LoadingState({ embedded }: Readonly<{ embedded: boolean }>) {
  return (
    <div
      className={cn('grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]', embedded && 'xl:grid-cols-1')}
    >
      <Card>
        <CardContent className="flex min-h-[260px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-medium text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען הגדרות חנות
          </div>
        </CardContent>
      </Card>
      {!embedded ? (
        <Card>
          <CardContent className="flex min-h-[260px] items-center justify-center text-sm font-medium text-fg-subtle">
            אוסף מצב שמירה וקיצורי ניהול
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function StoreSettingsWorkspace({
  embedded = false,
}: Readonly<StoreSettingsWorkspaceProps>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useRBAC();
  const [form, setForm] = useState<StoreSettingsDto | null>(null);
  const [baseline, setBaseline] = useState<StoreSettingsDto | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<StoreSettingsSnapshot>('/api/store/settings');
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'טעינת הגדרות החנות נכשלה');
      }
      return response.data;
    },
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    if (form || baseline) return;

    const nextForm = toFormState(data);
    setForm(nextForm);
    setBaseline(nextForm);
  }, [baseline, data, form]);

  const saveMutation = useMutation({
    mutationFn: async (payload: StoreSettingsDto) => {
      const response = await apiClient.patch<StoreSettingsSnapshot>('/api/store/settings', payload);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'שמירת הגדרות החנות נכשלה');
      }
      return response.data;
    },
    onSuccess: (snapshot) => {
      const nextForm = toFormState(snapshot);
      queryClient.setQueryData(SETTINGS_QUERY_KEY, snapshot);
      setForm(nextForm);
      setBaseline(nextForm);
      toast.success('הגדרות החנות נשמרו', 'המערכת תשתמש בערכים החדשים באופן מיידי');
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error ? mutationError.message : 'שמירת ההגדרות נכשלה';
      toast.error('לא ניתן לשמור את ההגדרות', message);
    },
  });

  const isDirty = useMemo(() => {
    if (!form || !baseline) return false;
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [baseline, form]);

  const routeOrigin = useMemo(() => {
    if (!form) return null;
    return resolveStoreRouteOrigin(form);
  }, [form]);

  const storeAddressLabel = useMemo(() => {
    if (!form) return 'לא הוגדרה כתובת חנות';
    return formatStoreAddress([form.storeAddressLine, form.storeCity]) || 'לא הוגדרה כתובת חנות';
  }, [form]);

  function updateField<K extends keyof StoreSettingsDto>(field: K, value: StoreSettingsDto[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function resetForm() {
    if (!baseline) return;
    setForm({ ...baseline });
  }

  function handleWarehouseFieldChange(
    field: 'warehouseAddressLine' | 'warehouseCity',
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
            warehouseLat: null,
            warehouseLng: null,
          }
        : current
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    await saveMutation.mutateAsync(form);
  }

  if (isLoading && !form) {
    return <LoadingState embedded={embedded} />;
  }

  if (!form || !baseline) {
    return (
      <Card>
        <CardContent className="flex min-h-[220px] items-center justify-center text-sm font-medium text-danger">
          {isError
            ? error instanceof Error
              ? error.message
              : 'טעינת הגדרות החנות נכשלה'
            : 'לא נמצאו הגדרות להצגה'}
        </CardContent>
      </Card>
    );
  }

  const sideColumn = (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>סטטוס ההגדרות</CardTitle>
              <CardDescription>
                מסך אחד להגדרות החנות והתפעול שמחובר ישירות ללוגיקה העסקית.
              </CardDescription>
            </div>
            <Badge variant={data?.source === 'database' ? 'success' : 'warning'}>
              {data?.source === 'database' ? 'שמור' : 'ברירות מחדל'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <SummaryItem label="חנות" value={form.storeName} tone="success" />
          <SummaryItem
            label="שעות עבודה"
            value={`${form.businessDayStartTime}-${form.businessDayEndTime}`}
          />
          <SummaryItem
            label="מוצא למסלולים"
            value={routeOrigin?.label || 'לא הוגדרה כתובת מוצא'}
            tone={routeOrigin?.label ? 'default' : 'warning'}
          />
          <SummaryItem label="רכש אוטומטי" value={form.autoPurchaseOrder ? 'פעיל' : 'כבוי'} />
          <SummaryItem label="עודכן לאחרונה" value={formatUpdatedAt(data?.updatedAt)} />
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg-muted">
            <Badge variant={routeOrigin?.mode === 'store' ? 'info' : 'secondary'}>
              {routeOrigin?.mode === 'store' ? 'כתובת החנות' : 'מחסן/איסוף נפרד'}
            </Badge>
            {isDirty ? 'יש שינויים שלא נשמרו' : 'המסך מסונכרן עם המערכת'}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={!isDirty || saveMutation.isPending}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              בטל
            </Button>
            <Button
              type="submit"
              form="store-settings-form"
              loading={saveMutation.isPending}
              disabled={!isDirty}
              icon={<Save className="h-4 w-4" />}
            >
              שמור
            </Button>
          </div>
        </CardFooter>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>קיצורי ניהול</CardTitle>
            <CardDescription>
              גישה לכל מסכי האדמין מתוך ממשק ניהול החנות — משתמשים, תבניות, אינטגרציות, גיבוי ועוד.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ADMIN_CONSOLE_NAV_ENTRIES.map((entry) => (
              <ShortcutLink
                key={entry.id}
                href={entry.href}
                icon={entry.icon}
                title={entry.title}
                description={entry.description}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  return (
    <form
      id="store-settings-form"
      onSubmit={handleSubmit}
      className={cn('space-y-4', embedded ? 'pb-2' : 'pb-6')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[28px] border border-subtle bg-surface-translucent-strong px-5 py-4 shadow-sm">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">הגדרות מאוחדות</Badge>
            <Badge variant={routeOrigin?.label ? 'success' : 'warning'}>
              {routeOrigin?.label ? 'מוכן למסלולים' : 'חסר מוצא למסלולים'}
            </Badge>
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-fg">
              {form.storeName || 'הגדרות חנות'}
            </div>
            <div className="mt-1 text-sm font-medium text-fg-muted">
              הכתובת שמוגדרת כאן תשמש את יצירת המסלולים, המספור, ברירות המחדל לרכש וההתאמות הבסיסיות
              של החנות.
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-subtle bg-surface-muted px-4 py-3 text-right">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-muted">
            מוצא נוכחי
          </div>
          <div className="mt-1 text-sm font-semibold text-fg">
            {routeOrigin?.label || 'לא הוגדר'}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]',
          embedded && 'xl:grid-cols-[minmax(0,1fr)_320px]'
        )}
      >
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-highlight text-fg-muted">
                  <Store className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>פרטי החנות</CardTitle>
                  <CardDescription>
                    הפרטים הבסיסיים שהמנהל צריך לתחזק עבור העבודה היומית והמסמכים.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="storeName">שם החנות</Label>
                <Input
                  id="storeName"
                  value={form.storeName}
                  onChange={(event) => updateField('storeName', event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeEmail">אימייל חנות</Label>
                <Input
                  id="storeEmail"
                  type="email"
                  value={form.storeEmail}
                  onChange={(event) => updateField('storeEmail', event.target.value)}
                  placeholder="store@example.com"
                  className="text-left"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storePhone">טלפון חנות</Label>
                <Input
                  id="storePhone"
                  value={form.storePhone}
                  onChange={(event) => updateField('storePhone', event.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="storeAddressLine">כתובת חנות</Label>
                <Input
                  id="storeAddressLine"
                  value={form.storeAddressLine}
                  onChange={(event) => updateField('storeAddressLine', event.target.value)}
                  placeholder="רחוב, מספר, אזור"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeCity">עיר</Label>
                <Input
                  id="storeCity"
                  value={form.storeCity}
                  onChange={(event) => updateField('storeCity', event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultCurrency">מטבע ברירת מחדל</Label>
                <Select
                  id="defaultCurrency"
                  value={form.defaultCurrency}
                  options={CURRENCY_OPTIONS}
                  onValueChange={(value) =>
                    updateField('defaultCurrency', value as StoreSettingsDto['defaultCurrency'])
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">אזור זמן</Label>
                <Select
                  id="timezone"
                  value={form.timezone}
                  options={TIMEZONE_OPTIONS}
                  onValueChange={(value) => updateField('timezone', value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">שפת ממשק</Label>
                <Select
                  id="language"
                  value={form.language}
                  options={LANGUAGE_OPTIONS}
                  onValueChange={(value) =>
                    updateField('language', value as StoreSettingsDto['language'])
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDayStartTime">תחילת יום עבודה</Label>
                <Input
                  id="businessDayStartTime"
                  type="time"
                  value={form.businessDayStartTime}
                  onChange={(event) => updateField('businessDayStartTime', event.target.value)}
                  className="text-left"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDayEndTime">סיום יום עבודה</Label>
                <Input
                  id="businessDayEndTime"
                  type="time"
                  value={form.businessDayEndTime}
                  onChange={(event) => updateField('businessDayEndTime', event.target.value)}
                  className="text-left"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-subtle px-4 py-3 text-sm font-medium text-fg-muted md:col-span-2">
                אם עומס המסלול היומי חורג מהחלון הזה, המערכת תחסום תיאומים חדשים לאותו יום.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-highlight text-fg-muted">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>מחסן ואיסוף למסלולים</CardTitle>
                  <CardDescription>
                    המיקום שממנו המערכת מתחילה חישוב מסלול במפת המסירות.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-subtle bg-surface-muted px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-fg">
                    השתמש בכתובת החנות כמוצא
                  </div>
                  <div className="text-xs font-medium text-fg-muted">
                    אם כבוי, אפשר להגדיר מחסן/נקודת איסוף אחרת למסלולים.
                  </div>
                </div>
                <Switch
                  checked={form.useStoreAddressAsWarehouse}
                  onCheckedChange={(checked) => updateField('useStoreAddressAsWarehouse', checked)}
                />
              </div>

              <div className="rounded-2xl border border-dashed border-subtle px-4 py-3 text-sm font-medium text-fg-muted">
                מוצא פעיל למסלולים:{' '}
                <span className="font-semibold text-fg">
                  {routeOrigin?.label || 'לא הוגדר'}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="warehouseAddressLine">כתובת מחסן / איסוף</Label>
                  <Input
                    id="warehouseAddressLine"
                    value={form.warehouseAddressLine}
                    onChange={(event) =>
                      handleWarehouseFieldChange('warehouseAddressLine', event.target.value)
                    }
                    placeholder={
                      form.useStoreAddressAsWarehouse ? storeAddressLabel : 'רחוב, מספר, אזור'
                    }
                    disabled={form.useStoreAddressAsWarehouse}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouseCity">עיר מחסן / איסוף</Label>
                  <Input
                    id="warehouseCity"
                    value={form.warehouseCity}
                    onChange={(event) =>
                      handleWarehouseFieldChange('warehouseCity', event.target.value)
                    }
                    placeholder={
                      form.useStoreAddressAsWarehouse ? form.storeCity : 'לדוגמה: תל אביב'
                    }
                    disabled={form.useStoreAddressAsWarehouse}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="warehouseLat">Lat</Label>
                    <Input
                      id="warehouseLat"
                      type="number"
                      step="0.000001"
                      value={form.warehouseLat ?? ''}
                      onChange={(event) =>
                        updateField(
                          'warehouseLat',
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      disabled={form.useStoreAddressAsWarehouse}
                      className="text-left"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warehouseLng">Lng</Label>
                    <Input
                      id="warehouseLng"
                      type="number"
                      step="0.000001"
                      value={form.warehouseLng ?? ''}
                      onChange={(event) =>
                        updateField(
                          'warehouseLng',
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      disabled={form.useStoreAddressAsWarehouse}
                      className="text-left"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-highlight text-fg-muted">
                  <Boxes className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>ברירות מחדל תפעוליות</CardTitle>
                  <CardDescription>
                    הגדרות שמשפיעות בפועל על יצירת הזמנות, רכש וניהול מלאי.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orderNumberPrefix">קידומת מספר הזמנה</Label>
                <Input
                  id="orderNumberPrefix"
                  value={form.orderNumberPrefix}
                  onChange={(event) => updateField('orderNumberPrefix', event.target.value)}
                  className="text-left"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRatePercent">אחוז מע״מ / מס</Label>
                <Input
                  id="taxRatePercent"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.taxRatePercent}
                  onChange={(event) =>
                    updateField('taxRatePercent', Number(event.target.value || 0))
                  }
                  className="text-left"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">סף מלאי נמוך</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min={0}
                  step="1"
                  value={form.lowStockThreshold}
                  onChange={(event) =>
                    updateField('lowStockThreshold', Number(event.target.value || 0))
                  }
                  className="text-left"
                />
              </div>

              <div className="rounded-2xl border border-subtle bg-surface-muted px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-fg">יצירת רכש אוטומטית</div>
                    <div className="text-xs font-medium text-fg-muted">
                      אם פריט חסר במלאי, המערכת תסמן אותו מיידית לזרימת רכש.
                    </div>
                  </div>
                  <Switch
                    checked={form.autoPurchaseOrder}
                    onCheckedChange={(checked) => updateField('autoPurchaseOrder', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {sideColumn}
      </div>
    </form>
  );
}

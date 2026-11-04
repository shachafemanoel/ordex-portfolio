import type { IntakeDecision, OpsItem, RawOrderItem, OrderOpsData } from './types';

type DeliveryOrderLike = {
  shippingAddress?: {
    fullAddress?: string | null;
    city?: string | null;
    street?: string | null;
    number?: string | null;
    floor?: string | null;
    apartment?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  addressLine?: string | null;
  city?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  floor?: string | null;
  apartment?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function normalizeItem(raw: RawOrderItem): OpsItem {
  const rawItem = raw as RawOrderItem & {
    quantity?: number | string | null;
    qty?: number | null;
    qtyRequested?: number | string | null;
    qtyOrdered?: number | string | null;
    quantityOrdered?: number | string | null;
    supplierId?: string | null;
    supplier?: { id?: string | null; name?: string | null } | null;
  };

  const quantityCandidates = [
    rawItem.quantity,
    rawItem.qty,
    rawItem.qtyRequested,
    rawItem.qtyOrdered,
    rawItem.quantityOrdered,
    rawItem.receivedQuantity,
  ];

  const resolvedQuantity = quantityCandidates.reduce<number | null>((current, candidate) => {
    if (current && current > 0) return current;
    const parsed =
      typeof candidate === 'number'
        ? candidate
        : typeof candidate === 'string'
          ? Number(candidate)
          : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
    return current;
  }, null);

  return {
    id: raw.id,
    name: raw.name || 'פריט ללא שם',
    sku: raw.sku || '-',
    quantity: resolvedQuantity ?? 1,
    supplierId: rawItem.supplierId ?? rawItem.supplier?.id ?? null,
    supplierName: rawItem.supplier?.name ?? null,
    received: Boolean(raw.received),
    receivedQuantity: raw.receivedQuantity ?? 0,
    allocationStatus: raw.allocationStatus ?? 'PENDING',
  };
}

export function normalizeOrderItems(orderData: OrderOpsData | undefined | null): OpsItem[] {
  if (!orderData) return [];

  let sourceItems: RawOrderItem[] = [];
  const directItems = Array.isArray(orderData?.items) ? orderData.items : [];
  if (directItems.length > 0) {
    sourceItems = directItems as RawOrderItem[];
  } else {
    // Legacy handling
    sourceItems = Array.isArray((orderData as any)?.lineItems)
      ? ((orderData as any).lineItems as RawOrderItem[])
      : [];
  }

  return sourceItems.map(normalizeItem);
}

export function isItemReady(item: OpsItem): boolean {
  return (
    item.allocationStatus === 'ALLOCATED' || item.received || item.receivedQuantity >= item.quantity
  );
}

export function getItemIntakeDecision(item: OpsItem): IntakeDecision | null {
  if (isItemReady(item)) return 'STOCK';
  if (item.allocationStatus === 'ON_ORDER' || item.allocationStatus === 'OUT_OF_STOCK') {
    return 'PO';
  }
  return null;
}

export function buildIntakeDecisionsFromItems(items: OpsItem[]): Record<string, IntakeDecision> {
  const decisions: Record<string, IntakeDecision> = {};

  for (const item of items) {
    const decision = getItemIntakeDecision(item);
    if (decision) {
      decisions[item.id] = decision;
    }
  }

  return decisions;
}

export function getItemStateLabel(item: OpsItem): {
  label: string;
  variant: 'success' | 'warning' | 'outline';
} {
  if (isItemReady(item)) return { label: 'זמין', variant: 'success' };
  if (item.allocationStatus === 'ON_ORDER') return { label: 'בהזמנת רכש', variant: 'warning' };
  return { label: 'ממתין לקליטה', variant: 'outline' };
}

export function toInputDateTimeValue(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

export function toDateInputValue(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export const DELIVERY_WINDOW_OPTIONS = [
  { label: '09:00-12:00', value: '09:00-12:00' },
  { label: '12:00-15:00', value: '12:00-15:00' },
  { label: '15:00-18:00', value: '15:00-18:00' },
  { label: '18:00-21:00', value: '18:00-21:00' },
] as const;

export type SmartScheduleSuggestion = {
  id: string;
  title: string;
  hint: string;
  dateValue: string;
  windowValue: string;
  loadCount: number;
};

export function getDefaultScheduleDateValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return toDateInputValue(date);
}

export function getDefaultScheduleWindowValue() {
  return DELIVERY_WINDOW_OPTIONS[0].value;
}

export function buildDateShortcut(daysAhead: number, hours = 9, minutes = 0): string {
  const next = new Date();
  next.setDate(next.getDate() + daysAhead);
  next.setHours(hours, minutes, 0, 0);
  return toInputDateTimeValue(next);
}

export function buildDateOnlyShortcut(daysAhead: number): string {
  const next = new Date();
  next.setDate(next.getDate() + daysAhead);
  next.setHours(12, 0, 0, 0);
  return toDateInputValue(next);
}

function buildLocalSlotDate(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`);
}

export function splitTimeWindow(window: string): { start: string; end: string } | null {
  const [start, end] = window.split('-');
  if (!start || !end) return null;
  return { start, end };
}

function buildIsoFromDateAndTime(dateValue: string, timeValue: string): string {
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

export function buildScheduleWindowPayload(dateValue: string, window: string) {
  const parsedWindow = splitTimeWindow(window);
  if (!dateValue || !parsedWindow) return null;

  return {
    scheduledAtIso: buildIsoFromDateAndTime(dateValue, parsedWindow.start),
    scheduledEndIso: buildIsoFromDateAndTime(dateValue, parsedWindow.end),
    timeWindowStart: parsedWindow.start,
    timeWindowEnd: parsedWindow.end,
  };
}

export function deriveScheduleWindowValue(
  timeWindowStart?: string | null,
  timeWindowEnd?: string | null
): string {
  if (timeWindowStart && timeWindowEnd) {
    return `${timeWindowStart}-${timeWindowEnd}`;
  }

  return getDefaultScheduleWindowValue();
}

function buildWindowHint(windowValue: string, city?: string | null) {
  const citySuffix = city ? ` באזור ${city}` : '';

  switch (windowValue) {
    case '09:00-12:00':
      return `פתיחה מוקדמת של סבב הבוקר${citySuffix}`;
    case '12:00-15:00':
      return `חלון מאוזן למסלול אמצע יום${citySuffix}`;
    case '15:00-18:00':
      return `משאיר זמן קליטה ואיסוף לפני היציאה${citySuffix}`;
    case '18:00-21:00':
      return `מתאים ללקוחות שזמינים רק בערב${citySuffix}`;
    default:
      return `חלון אספקה מומלץ${citySuffix}`;
  }
}

function buildLoadAwareHint(windowValue: string, loadCount: number, city?: string | null) {
  const baseHint = buildWindowHint(windowValue, city);
  if (loadCount <= 0) {
    return `${baseHint} • כרגע החלון פנוי`;
  }

  return `${baseHint} • כבר יש ${loadCount} תיאומים בחלון הזה`;
}

export function deriveWindowValueFromScheduledAt(value?: string | Date | null): string | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const hour = date.getHours();
  if (hour < 12) return '09:00-12:00';
  if (hour < 15) return '12:00-15:00';
  if (hour < 18) return '15:00-18:00';
  return '18:00-21:00';
}

export function getSmartScheduleSuggestions(options?: {
  city?: string | null;
  existingLoads?: Record<string, number>;
  now?: Date;
  limit?: number;
}): SmartScheduleSuggestion[] {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 3;
  const minLeadMs = 2 * 60 * 60 * 1000;
  const windowPriority: Record<string, number> = {
    '12:00-15:00': 0,
    '09:00-12:00': 1,
    '15:00-18:00': 2,
    '18:00-21:00': 3,
  };

  const candidates = Array.from({ length: 5 }, (_, dayOffset) => {
    const dateValue = buildDateOnlyShortcut(dayOffset);

    return DELIVERY_WINDOW_OPTIONS.map((windowOption) => {
      const parsedWindow = splitTimeWindow(windowOption.value);
      if (!parsedWindow) return null;

      const slotStart = buildLocalSlotDate(dateValue, parsedWindow.start);
      if (slotStart.getTime() - now.getTime() < minLeadMs) {
        return null;
      }

      const loadKey = `${dateValue}__${windowOption.value}`;
      const loadCount = options?.existingLoads?.[loadKey] ?? 0;

      return {
        dateValue,
        windowValue: windowOption.value,
        loadCount,
        score: dayOffset * 10 + (windowPriority[windowOption.value] ?? 9) + loadCount * 4,
      };
    });
  })
    .flat()
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => left.score - right.score)
    .slice(0, limit);

  const suggestionTitles = ['מומלץ עכשיו', 'מסלול יעיל', 'עם מרווח תפעולי'];

  return candidates.map((candidate, index) => ({
    id: `${candidate.dateValue}-${candidate.windowValue}`,
    title: suggestionTitles[index] ?? 'הצעה נוספת',
    hint: buildLoadAwareHint(candidate.windowValue, candidate.loadCount, options?.city),
    dateValue: candidate.dateValue,
    windowValue: candidate.windowValue,
    loadCount: candidate.loadCount,
  }));
}

export function formatOpsSchedule(
  value?: string | Date | null,
  timeWindowStart?: string | null,
  timeWindowEnd?: string | null
): string {
  if (!value) return 'לא נקבע';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'לא נקבע';

  const dateLabel = date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
  });

  if (timeWindowStart && timeWindowEnd) {
    return `${dateLabel} • ${timeWindowStart}-${timeWindowEnd}`;
  }

  return date.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

export function formatOpsDateTime(value?: string | Date | null): string {
  if (!value) return 'לא נקבע';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'לא נקבע';

  return date.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildDeliveryAddress(order: DeliveryOrderLike): string {
  const fullAddress = order.shippingAddress?.fullAddress?.trim();
  if (fullAddress) {
    return fullAddress;
  }

  const street = order.shippingAddress?.street ?? order.street ?? '';
  const number = order.shippingAddress?.number ?? order.houseNumber ?? '';
  const city = order.shippingAddress?.city ?? order.city ?? '';
  const floor = order.shippingAddress?.floor ?? order.floor ?? '';
  const apartment = order.shippingAddress?.apartment ?? order.apartment ?? '';
  const primaryLine = [street, number].filter(Boolean).join(' ').trim();
  const detailParts = [city, floor ? `קומה ${floor}` : null, apartment ? `דירה ${apartment}` : null]
    .filter(Boolean)
    .join(', ');

  if (primaryLine || detailParts) {
    return [primaryLine, detailParts].filter(Boolean).join(', ');
  }

  return order.addressLine?.trim() || 'ללא כתובת מלאה';
}

export function buildScheduleAddressPayload(order: DeliveryOrderLike | null | undefined) {
  if (!order) return undefined;

  const city = order.shippingAddress?.city ?? order.city ?? undefined;
  const street = order.shippingAddress?.street ?? order.street ?? undefined;
  const number = order.shippingAddress?.number ?? order.houseNumber ?? undefined;
  const floor = order.shippingAddress?.floor ?? order.floor ?? undefined;
  const lat =
    order.shippingAddress?.lat ??
    order.lat ??
    order.latitude ??
    undefined;
  const lng =
    order.shippingAddress?.lng ??
    order.lng ??
    order.longitude ??
    undefined;

  if (!city || !street || !number) {
    return undefined;
  }

  return {
    city,
    street,
    number,
    floor,
    lat: typeof lat === 'number' ? lat : undefined,
    lng: typeof lng === 'number' ? lng : undefined,
  };
}

export function buildWazeLink(order: DeliveryOrderLike): string {
  const lat = order.lat ?? order.latitude ?? null;
  const lng = order.lng ?? order.longitude ?? null;

  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }

  return `https://waze.com/ul?q=${encodeURIComponent(buildDeliveryAddress(order))}`;
}

export function getStatusOperationalHint(status: string): string {
  switch (status) {
    case 'DRAFT':
    case 'TO_DO':
      return 'הזמנה חדשה שממתינה להתחלת טיפול.';
    case 'PO_CREATED':
    case 'AWAITING_STOCK':
      return 'ממתינים למלאי מספקים לפני תיאום משלוח.';
    case 'PARTIALLY_SUPPLIED':
      return 'חלק מהפריטים זמינים, יש להשלים קליטה.';
    case 'READY_FOR_INSTALL':
    case 'AWAITING_INSTALL':
      return 'ההזמנה מוכנה, נדרש לקבוע/לאשר מועד אספקה.';
    case 'SCHEDULED':
      return 'משלוח מתוזמן ומוכן להעברה לתפעול שליחים.';
    case 'IN_TRANSIT':
      return 'ההזמנה בטיפול שליח ובדרך ללקוח.';
    case 'SUPPLIED':
    case 'COMPLETED':
      return 'האספקה הושלמה בהצלחה.';
    default:
      return 'סטטוס תפעולי של ההזמנה בזמן אמת.';
  }
}

export function extractSuppliersFromResponse(payload: unknown): { id: string; name: string }[] {
  if (!payload || typeof payload !== 'object') return [];

  const body = payload as any;
  const candidates = Array.isArray(body?.data?.items)
    ? body.data.items
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.items)
        ? body.items
        : [];

  return candidates
    .map((supplier: any) => ({
      id: String(supplier?.id ?? ''),
      name: String(supplier?.name ?? '').trim(),
    }))
    .filter((supplier: { id: string; name: string }) => supplier.id.length > 0 && supplier.name.length > 0);
}

export function buildScheduleAddress(order: OrderOpsData) {
  const shippingAddress = order.shippingAddress;
  if (
    !shippingAddress ||
    !shippingAddress.city ||
    !shippingAddress.street ||
    !shippingAddress.number
  ) {
    return undefined;
  }
  return {
    city: shippingAddress.city,
    street: shippingAddress.street,
    number: shippingAddress.number,
    floor: shippingAddress.floor || undefined,
  };
}

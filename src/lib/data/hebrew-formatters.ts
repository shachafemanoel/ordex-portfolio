import { format, isValid } from 'date-fns';
import { he } from 'date-fns/locale';

export const HebrewFormatters = {
  // --- Date & Time ---
  formatDate: (date: Date | string | null | undefined, pattern = 'dd/MM/yyyy'): string => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!isValid(d)) return '—';
    return format(d, pattern, { locale: he });
  },

  formatDateTime: (date: Date | string | null | undefined): string => {
    return HebrewFormatters.formatDate(date, 'dd/MM/yyyy HH:mm');
  },

  formatRelativeTime: (date: Date | string | null | undefined): string => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!isValid(d)) return '—';

    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'היום';
    if (diffDays === 1) return 'מחר';
    if (diffDays === -1) return 'אתמול';
    if (diffDays > 0) return `בעוד ${diffDays} ימים`;
    return `לפני ${Math.abs(diffDays)} ימים`;
  },

  // --- Currency ---
  formatCurrency: (amount: number | null | undefined, currency = 'ILS'): string => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  // --- Phone ---
  formatPhone: (phone: string | null | undefined): string => {
    if (!phone) return '—';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) return `0${cleaned.slice(3)}`;
    return phone; // Return as-is if no standard format matches or already formatted
  },

  // --- Address ---
  formatAddress: (
    city?: string | null,
    street?: string | null,
    number?: string | null,
    apartment?: string | null
  ): string => {
    const parts = [
      street,
      number ? ` ${number}` : '',
      apartment ? `, דירה ${apartment}` : '',
      city ? `, ${city}` : '',
    ].filter(Boolean);

    return parts.join('') || 'כתובת לא ידועה';
  }
};

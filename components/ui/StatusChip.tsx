'use client';

import { getEntityBadgeClassName, EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getEntityStatusDisplay, getEntityToneDotClass } from '@/components/shared/display/displayStatus';
import {
  CanonicalOrderStatus,
  getCanonicalStatusLabel,
  normalizeToCanonicalStatus,
  ORDER_STATUS_CONFIG,
} from '@/lib/orderStatus';
import { cn } from '@/lib/utils';

export interface StatusChipProps {
  status: string;
  variant?: 'order' | 'purchase' | 'installation' | 'payment';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ORDER_STATUS_ICONS: Partial<Record<CanonicalOrderStatus, string>> = {
  DRAFT: '📝',
  TO_DO: '📋',
  CALL_BACK: '📞',
  PO_CREATED: '🛒',
  AWAITING_STOCK: '📦',
  PARTIALLY_SUPPLIED: '📊',
  READY_FOR_INSTALL: '🔧',
  SCHEDULED: '📅',
  COMPLETED: '🎉',
  CANCELLED: '❌',
};

const purchaseStatusConfig = {
  OPEN: { label: 'פתוח', tone: 'info' },
  PARTIAL: { label: 'חלקי', tone: 'warning' },
  COMPLETE: { label: 'הושלם', tone: 'success' },
  CANCELLED: { label: 'בוטל', tone: 'warning' },
};

const installationStatusConfig = {
  PENDING: { label: 'ממתין', tone: 'neutral' },
  SCHEDULED: { label: 'מתוזמן', tone: 'info' },
  IN_PROGRESS: { label: 'בביצוע', tone: 'warning' },
  COMPLETED: { label: 'הושלם', tone: 'success' },
  CANCELLED: { label: 'בוטל', tone: 'warning' },
};

const paymentStatusConfig = {
  pending: { label: 'ממתין', tone: 'warning' },
  paid: { label: 'שולם', tone: 'success' },
  failed: { label: 'נכשל', tone: 'warning' },
  refunded: { label: 'הוחזר', tone: 'neutral' },
};

const sizeClasses = {
  sm: 'tracking-[0.08em]',
  md: 'tracking-[0.06em]',
  lg: 'tracking-[0.04em]',
};

/**
 * Renders canonical status as a themed chip.
 * Order statuses map to tones via `getEntityStatusDisplay` (info/success/warning/accent/neutral).
 */
export function StatusChip({ status, variant = 'order', size = 'md', className }: StatusChipProps) {
  const statusDisplay = getEntityStatusDisplay(
    status,
    variant === 'order' ? 'order' : variant === 'purchase' ? 'purchase' : variant === 'installation' ? 'installation' : 'payment'
  );
  const getConfig = () => {
    switch (variant) {
      case 'purchase':
        return purchaseStatusConfig;
      case 'installation':
        return installationStatusConfig;
      case 'payment':
        return paymentStatusConfig;
      default:
        // Order statuses are normalized to canonical to avoid legacy strings in UI
        const canonical = normalizeToCanonicalStatus(status);
        return {
          [canonical]: {
            label: getCanonicalStatusLabel(canonical),
            icon: ORDER_STATUS_ICONS[canonical],
          },
        } as Record<string, { label: string; icon?: string }>;
    }
  };

  const config = getConfig();
  const orderStatusKey = variant === 'order' ? normalizeToCanonicalStatus(status) : status;
  const statusInfo: { label: string; icon?: string } = (config as any)[orderStatusKey] || {
    label: orderStatusKey,
  };

  return (
    <EntityBadge
      label={statusInfo.icon ? `${statusInfo.icon} ${statusDisplay.label}` : statusDisplay.label}
      tone={statusDisplay.tone}
      size={size}
      dotClassName={getEntityToneDotClass(statusDisplay.tone)}
      className={cn(sizeClasses[size], className)}
    />
  );
}

// Utility function to get status color class for other components
export function getStatusColor(status: string, variant: StatusChipProps['variant'] = 'order') {
  const display = getEntityStatusDisplay(
    status,
    variant === 'order' ? 'order' : variant === 'purchase' ? 'purchase' : variant === 'installation' ? 'installation' : 'payment'
  );
  return getEntityBadgeClassName(display.tone);
}

// Hook for status translations
export function useStatusLabel(status: string, variant: StatusChipProps['variant'] = 'order') {
  if (variant === 'order') {
    return getCanonicalStatusLabel(normalizeToCanonicalStatus(status));
  }
  const config =
    variant === 'purchase'
      ? purchaseStatusConfig
      : variant === 'installation'
        ? installationStatusConfig
        : variant === 'payment'
          ? paymentStatusConfig
          : ORDER_STATUS_CONFIG;

  const statusInfo = (config as any)[status] as { label: string; tone?: string } | undefined;
  return statusInfo?.label || status;
}

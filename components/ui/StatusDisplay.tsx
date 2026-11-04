/**
 * StatusDisplay Component
 *
 * Unified status display component that consolidates StatusBadge and StatusChip.
 * Supports multiple status types, variants, sizes, and icons.
 *
 * Features:
 * - Multiple status types (order, purchase, installation, payment)
 * - Multiple variants (badge, chip, card)
 * - Flexible sizing (sm, md, lg)
 * - Optional icons
 * - RTL support
 * - Type-safe with Prisma enums
 */

'use client';

import { 
  getEntityBadgeClassName,
  type EntityTone,
  type EntityBadgeSize
} from '@/components/shared/display/EntityPrimitives';
import { 
  getEntityStatusDisplay, 
  getEntityToneDotClass, 
  STATUS_ICONS 
} from '@/components/shared/display/displayStatus';
import { tokens } from '@/lib/design-tokens';
import {
  CanonicalOrderStatus,
  getCanonicalStatusLabel,
  normalizeToCanonicalStatus,
} from '@/lib/orderStatus';
import {
  tPayment,
  tPurchaseOrder,
  tTask,
} from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type {
  InstallationTaskStatus,
  OrderStatus,
  PaymentStatus,
  PurchaseOrderStatus,
} from '@prisma/client';
import React, { memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type StatusType = 'order' | 'purchase' | 'installation' | 'payment';
export type StatusVariant = 'badge' | 'chip' | 'card';
export type StatusSize = 'sm' | 'md' | 'lg';

export interface StatusDisplayProps {
  /** Status value */
  status: OrderStatus | PurchaseOrderStatus | PaymentStatus | InstallationTaskStatus | string;

  /** Status type (determines color scheme) */
  type?: StatusType;

  /** Visual variant */
  variant?: StatusVariant;

  /** Size */
  size?: StatusSize;

  /** Show icon */
  showIcon?: boolean;

  /** Custom icon */
  icon?: React.ReactNode;

  /** Clickable (shows pointer cursor) */
  onClick?: () => void;

  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get configuration based on status type
 */
function getStatusConfig(type: StatusType, status: string) {
  const statusKey = String(status).toUpperCase();
  const Icon = STATUS_ICONS[statusKey];

  switch (type) {
    case 'purchase':
      return {
        label: tPurchaseOrder('status', statusKey as any),
        color: '',
        Icon,
      };
    case 'installation':
      return {
        label: tTask('type', `INSTALL_${statusKey}` as any, { fallback: statusKey }),
        color: '',
        Icon,
      };
    case 'payment':
      return {
        label: tPayment('status', statusKey as any),
        color: '',
        Icon,
      };
    default:
      const canonical = normalizeToCanonicalStatus(statusKey);
      return {
        label: getCanonicalStatusLabel(canonical),
        color: '',
        Icon: STATUS_ICONS[canonical] || Icon,
      };
  }
}

// ============================================================================
// SIZE CONFIGURATION
// ============================================================================

const SIZE_CLASSES: Record<StatusSize, { text: string; padding: string; icon: string }> = {
  sm: { text: 'text-xs', padding: '', icon: 'text-xs' },
  md: { text: 'text-sm', padding: '', icon: 'text-sm' },
  lg: { text: 'text-base', padding: '', icon: 'text-base' },
};

// ============================================================================
// VARIANT CONFIGURATION
// ============================================================================

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  badge: 'tracking-[0.02em]',
  chip: 'tracking-[0.02em] shadow-[var(--shadow-sm)]',
  card: 'min-w-[10rem] justify-start rounded-[var(--radius-xl)] px-4 py-3 shadow-[var(--shadow-md)]',
};

const CARD_TONE_CLASSES: Record<EntityTone, string> = {
  info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-strong)]',
  success: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-strong)]',
  warning: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-strong)]',
  accent: 'border-[var(--tone-accent-border)] bg-[var(--tone-accent-bg)] text-[var(--tone-accent-strong)]',
  neutral: 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * StatusDisplay - Unified status component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <StatusDisplay status="TO_DO" />
 *
 * // With type
 * <StatusDisplay status="PAID" type="payment" />
 *
 * // With variant and size
 * <StatusDisplay status="SCHEDULED" variant="chip" size="lg" showIcon />
 *
 * // Clickable
 * <StatusDisplay status="DRAFT" onClick={() => alert('Clicked!')} />
 * ```
 */
export const StatusDisplay: React.FC<StatusDisplayProps> = memo(
  ({
    status,
    type = 'order',
    variant = 'badge',
    size = 'md',
    showIcon = false,
    icon: customIcon,
    onClick,
    className,
  }) => {
    // Get status configuration
    const statusInfo = getStatusConfig(type, String(status)) || {
      label: String(status),
      icon: 'Dot',
    };
    const statusDisplay = getEntityStatusDisplay(String(status), type);

    // Get size classes
    const sizeClasses = SIZE_CLASSES[size];

    // Get variant classes
    const variantClasses = VARIANT_CLASSES[variant];

    // Determine icon to display
    const Icon = showIcon ? statusInfo.Icon : null;

    const Component = onClick ? 'button' : 'span';
    const toneClasses =
      variant === 'card'
        ? CARD_TONE_CLASSES[statusDisplay.tone]
        : getEntityBadgeClassName(statusDisplay.tone, size as EntityBadgeSize);

    return (
      <Component
        className={cn(
          toneClasses,
          variantClasses,
          sizeClasses.text,
          tokens.transition.colors,
          onClick && 'cursor-pointer hover:opacity-80 active:opacity-60',
          onClick && tokens.focusRing.default,
          className
        )}
        onClick={onClick}
        title={`${type === 'order' ? 'סטטוס' : type === 'payment' ? 'תשלום' : type === 'purchase' ? 'רכש' : 'התקנה'}: ${statusInfo.label}`}
        dir="rtl"
        {...(onClick && { type: 'button' })}
      >
        {customIcon ? (
           <span className={cn('shrink-0 flex items-center justify-center', sizeClasses.icon)}>{customIcon}</span>
        ) : Icon ? (
          <Icon className={cn('shrink-0', sizeClasses.icon)} />
        ) : (
          <span className={cn('h-2 w-2 shrink-0 rounded-full', getEntityToneDotClass(statusDisplay.tone))} />
        )}
        <span className="truncate">{statusDisplay.label || statusInfo.label}</span>
      </Component>
    );
  }
);

StatusDisplay.displayName = 'StatusDisplay';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get status label for display
 */
export function getStatusLabel(status: string, type: StatusType = 'order'): string {
  if (type === 'order') {
    return getCanonicalStatusLabel(normalizeToCanonicalStatus(status) as CanonicalOrderStatus);
  }
  const info = getStatusConfig(type, status);
  return info?.label || String(status);
}

/**
 * Get status color classes
 */
export function getStatusColorClasses(status: string, type: StatusType = 'order'): string {
  const info = getEntityStatusDisplay(status, type);
  return getEntityBadgeClassName(info.tone);
}

/**
 * Get status icon
 */
export function getStatusIcon(status: string, type: StatusType = 'order'): string | undefined {
  const info = getStatusConfig(type, status);
  return info?.Icon?.displayName;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default StatusDisplay;

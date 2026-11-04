'use client';

/**
 * ActionFeed
 * Shared component for displaying actionable items in a feed format.
 * Reusable across Dashboard, Orders, Customers, etc.
 */

import type { ActionButton, ActionableItem } from '@/lib/services/dashboard/ActionableItemsService';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  Clock,
  ExternalLink,
  FileText,
  Package,
  Phone,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionFeedCardProps {
  item: ActionableItem;
  onAction?: (action: ActionButton, item: ActionableItem) => void;
  onSnooze?: (item: ActionableItem) => void;
  compact?: boolean;
  className?: string;
}

const PRIORITY_STYLES = {
  URGENT: {
    border: 'border-l-4 border-l-red-500',
    bg: 'bg-red-50/50',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  HIGH: {
    border: 'border-l-4 border-l-blue-600',
    bg: 'bg-blue-50/30',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-600',
  },
  MEDIUM: {
    border: 'border-l-4 border-l-blue-400',
    bg: 'bg-white',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-400',
  },
  LOW: {
    border: 'border-l-4 border-l-slate-300',
    bg: 'bg-white',
    badge: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-300',
  },
};

const PRIORITY_LABELS = {
  URGENT: 'דחוף',
  HIGH: 'גבוה',
  MEDIUM: 'בינוני',
  LOW: 'נמוך',
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  wrench: Wrench,
  package: Package,
  file: FileText,
  'shopping-cart': ShoppingCart,
  calendar: Calendar,
  alert: AlertCircle,
};

function formatDueTime(dueAt: Date | null | undefined, isOverdue: boolean): string {
  if (!dueAt) return '';

  const now = new Date();
  const diff = dueAt.getTime() - now.getTime();
  const hours = Math.abs(Math.round(diff / (1000 * 60 * 60)));
  const days = Math.abs(Math.round(diff / (1000 * 60 * 60 * 24)));

  if (isOverdue) {
    if (hours < 24) return `באיחור של ${hours} שעות`;
    return `באיחור של ${days} ימים`;
  }

  if (hours < 1) return 'עוד מעט';
  if (hours < 24) return `בעוד ${hours} שעות`;
  if (days === 1) return 'מחר';
  return `בעוד ${days} ימים`;
}

export function ActionFeedCard({
  item,
  onAction,
  onSnooze,
  compact = false,
  className,
}: ActionFeedCardProps) {
  const styles = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.LOW;
  const Icon = ICON_MAP[item.icon || 'file'] || FileText;

  const handleActionClick = (action: ActionButton) => {
    if (action.action === 'snooze' && onSnooze) {
      onSnooze(item);
    } else if (action.action === 'navigate' && action.href) {
      // Navigation is handled by the Link component
      return;
    } else if (onAction) {
      onAction(action, item);
    }
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-slate-200 transition-all',
        'hover:shadow-sm hover:border-slate-300',
        styles.border,
        styles.bg,
        className
      )}
    >
      <div className={cn('p-3', compact ? 'space-y-1' : 'space-y-2')}>
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Priority Dot */}
            <div className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', styles.dot)} />

            {/* Icon */}
            <div
              className={cn(
                'shrink-0 p-1.5 rounded-md',
                item.priority === 'URGENT' || item.priority === 'HIGH'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-slate-100 text-slate-600'
              )}
            >
              <Icon className="w-4 h-4" />
            </div>

            {/* Title & Description */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-sm text-slate-900 truncate">{item.title}</h4>
                {(item.priority === 'URGENT' || item.isOverdue) && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      item.isOverdue ? 'bg-red-600 text-on-dark' : styles.badge
                    )}
                  >
                    {item.isOverdue ? 'באיחור' : PRIORITY_LABELS[item.priority]}
                  </span>
                )}
              </div>
              {item.description && !compact && (
                <p className="text-xs text-slate-500 truncate mt-0.5">{item.description}</p>
              )}
            </div>
          </div>

          {/* Due Time */}
          {item.dueAt && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs shrink-0',
                item.isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
              )}
            >
              <Clock className="w-3 h-3" />
              <span>{formatDueTime(new Date(item.dueAt), item.isOverdue)}</span>
            </div>
          )}
        </div>

        {/* Meta Row (Customer, Order Number) */}
        {(item.customerName || item.orderNumber) && !compact && (
          <div className="flex items-center gap-3 text-xs text-slate-500 pr-7">
            {item.customerName && <span>{item.customerName}</span>}
            {item.orderNumber && (
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                #{item.orderNumber}
              </span>
            )}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center gap-2 pr-7">
          {item.actions.slice(0, 3).map((action) => {
            if (action.action === 'navigate' && action.href) {
              // External links (like Google Maps)
              if (action.href.startsWith('http')) {
                return (
                  <a
                    key={action.id}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                      action.type === 'primary'
                        ? 'bg-blue-600 text-on-dark hover:bg-blue-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    {action.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                );
              }

              // Internal links
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                    action.type === 'primary'
                      ? 'bg-blue-600 text-on-dark hover:bg-blue-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {action.label}
                  <ChevronLeft className="w-3 h-3" />
                </Link>
              );
            }

            // Action buttons (snooze, api_call)
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                  action.type === 'primary'
                    ? 'bg-green-600 text-on-dark hover:bg-green-700'
                    : action.type === 'danger'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                {action.id === 'complete' && <CheckCircle className="w-3 h-3" />}
                {action.id === 'snooze' && <Clock className="w-3 h-3" />}
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionsFeed - List of ActionFeedCards
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionsFeedProps {
  items: ActionableItem[];
  onAction?: (action: ActionButton, item: ActionableItem) => void;
  onSnooze?: (item: ActionableItem) => void;
  maxItems?: number;
  emptyMessage?: string;
  className?: string;
  viewAllLink?: string;
}

export function ActionsFeed({
  items,
  onAction,
  onSnooze,
  maxItems = 10,
  emptyMessage = 'אין פריטים לטיפול - כל הכבוד! 🎉',
  className,
  viewAllLink = '/tasks',
}: ActionsFeedProps) {
  const displayItems = maxItems ? items.slice(0, maxItems) : items;

  if (items.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
        <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
        <p className="text-slate-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {displayItems.map((item) => (
        <ActionFeedCard key={item.id} item={item} onAction={onAction} onSnooze={onSnooze} />
      ))}
      {items.length > maxItems && (
        <Link
          href={viewAllLink}
          className="block text-center text-sm text-blue-600 hover:text-blue-700 py-2"
        >
          צפה בעוד {items.length - maxItems} פריטים ←
        </Link>
      )}
    </div>
  );
}

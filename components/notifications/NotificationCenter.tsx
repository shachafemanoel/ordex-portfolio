'use client';

import apiClient from '@/lib/apiClient';
import { NOTIFICATIONS_REFRESH_EVENT } from '@/lib/notifications/browser';
import { cn, formatDateTime } from '@/lib/utils';
import {
  ArrowPathIcon,
  BellAlertIcon,
  BellIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Compatible type matching the API response
type FeedNotification = {
  id: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS' | 'ERROR';
  category?: string;
  timestamp: string;
  read: boolean;
  link?: string | null;
  metadata?: Record<string, any> | null;
  isPersistent: boolean;
  // UI helpers
  actionLabel?: string;
  actionUrl?: string;
};

interface NotificationCenterProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Optional classes for the bell trigger (e.g. toolbar icon-only slot in mobile drawer) */
  triggerClassName?: string;
}

const severityMeta = {
  CRITICAL: {
    icon: BellAlertIcon,
    bg: 'bg-red-50',
    borderColor: 'border-red-200',
    color: 'text-red-600',
    badgeColor: 'bg-red-500',
  },
  ERROR: {
    icon: BellAlertIcon,
    bg: 'bg-red-50',
    borderColor: 'border-red-200',
    color: 'text-red-600',
    badgeColor: 'bg-red-500',
  },
  WARNING: {
    icon: ExclamationTriangleIcon,
    bg: 'bg-amber-50',
    borderColor: 'border-amber-200',
    color: 'text-amber-600',
    badgeColor: 'bg-amber-500',
  },
  INFO: {
    icon: InformationCircleIcon,
    bg: 'bg-blue-50',
    borderColor: 'border-blue-200',
    color: 'text-blue-600',
    badgeColor: 'bg-blue-500',
  },
  SUCCESS: {
    icon: CheckIcon,
    bg: 'bg-green-50',
    borderColor: 'border-green-200',
    color: 'text-green-600',
    badgeColor: 'bg-green-500',
  },
};

export function NotificationCenter({
  position = 'top-right',
  triggerClassName,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const groupedNotifications = useMemo(() => {
    const today: FeedNotification[] = [];
    const yesterday: FeedNotification[] = [];
    const older: FeedNotification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    filteredNotifications.forEach((notification) => {
      const notifDate = new Date(notification.timestamp);
      if (notifDate >= todayStart) {
        today.push(notification);
      } else if (notifDate >= yesterdayStart) {
        yesterday.push(notification);
      } else {
        older.push(notification);
      }
    });

    return { today, yesterday, older };
  }, [filteredNotifications]);

  const loadFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await apiClient('/api/notifications/feed');
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        console.warn('Notification feed request failed', {
          status: response.status,
          error: payload?.error,
        });
        setNotifications([]);
        return;
      }
      const payload = await response.json();
      const normalized: FeedNotification[] = (payload?.data || []).map(
        (item: any) => ({
          ...item,
          actionLabel: item.actionLabel || item.metadata?.actionLabel || (item.link ? 'View' : undefined),
          actionUrl: item.link || item.actionUrl,
        })
      );
      setNotifications(normalized);
    } catch (error) {
      console.error('Failed to load notification feed', error);
      setNotifications([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 60000);
    return () => clearInterval(interval);
  }, [loadFeed]);

  useEffect(() => {
    function handleNotificationsRefresh() {
      void loadFeed();
    }

    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handleNotificationsRefresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handleNotificationsRefresh);
    };
  }, [loadFeed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const dismissNotification = async (id: string, isPersistent: boolean) => {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
        await apiClient('/api/notifications/dismiss', {
            method: 'POST',
            body: JSON.stringify({ notificationId: id }),
        });
    } catch (e) {
        console.error('Failed to dismiss', e);
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

    try {
        await apiClient('/api/notifications/read', {
            method: 'POST',
            body: JSON.stringify({ notificationId: id }),
        });
    } catch (e) {
        console.error('Failed to mark as read', e);
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
        await apiClient('/api/notifications/read', {
            method: 'POST',
            body: JSON.stringify({ all: true }),
        });
    } catch (e) {
        console.error('Failed to mark all as read', e);
    }
  };

  const requestPermission = async () => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      await Notification.requestPermission();
    }
  };

  const positionClasses = {
    'top-right': 'top-16 right-4',
    'top-left': 'top-16 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full p-2 transition-all duration-200',
          'hover:bg-ordex-bg/80',
          unreadCount > 0 ? 'text-ordex-primary animate-pulse' : 'text-ordex-text-muted',
          isOpen && 'bg-ordex-bg/80',
          triggerClassName
        )}
        aria-label="מרכז התראות"
      >
        {unreadCount > 0 ? (
          <BellAlertIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        ) : (
          <BellIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-on-dark shadow-lg animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'fixed z-[9999] flex w-[420px] max-h-[680px] flex-col rounded-2xl',
            'border border-gray-200 bg-white shadow-2xl',
            'animate-in fade-in slide-in-from-top-2 duration-200',
            positionClasses[position]
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-purple-50/50 p-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">התראות</h3>
              <p className="text-xs text-gray-500 mt-0.5">מעקב אחר פעילות במערכת</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={requestPermission}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-white/80 hover:text-blue-600 hover:shadow-sm"
                aria-label="אפשר התראות דסקטופ"
                title="אפשר התראות דסקטופ"
              >
                <ShieldCheckIcon className="h-4 w-4" />
              </button>
              <button
                onClick={loadFeed}
                disabled={refreshing}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-white/80 hover:text-blue-600 hover:shadow-sm disabled:opacity-50"
                aria-label="רענן התראות"
                title="רענן התראות"
              >
                <ArrowPathIcon
                  className={cn('h-4 w-4', refreshing && 'animate-spin text-blue-600')}
                />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-white/80 hover:text-red-500 hover:shadow-sm"
                aria-label="סגור"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 p-3">
            <button
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                filter === 'all'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              )}
            >
              הכל <span className="text-xs opacity-70">({notifications.length})</span>
            </button>
            <button
              onClick={() => setFilter('unread')}
              aria-pressed={filter === 'unread'}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                filter === 'unread'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
              )}
            >
              לא נקראו <span className="text-xs opacity-70">({unreadCount})</span>
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="rounded-lg p-2 text-blue-600 transition-all hover:bg-blue-50"
                aria-label="סמן הכל כנקרא"
                title="סמן הכל כנקרא"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filteredNotifications.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-gray-400">
                <BellIcon className="mb-3 h-16 w-16 opacity-20" />
                <p className="text-sm font-medium">אין התראות חדשות</p>
                <p className="text-xs mt-1">כל היעדים הושלמו ✨</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {groupedNotifications.today.length > 0 && (
                  <NotificationGroup
                    title="היום"
                    notifications={groupedNotifications.today}
                    onDismiss={dismissNotification}
                    onMarkRead={markAsRead}
                  />
                )}
                {groupedNotifications.yesterday.length > 0 && (
                  <NotificationGroup
                    title="אתמול"
                    notifications={groupedNotifications.yesterday}
                    onDismiss={dismissNotification}
                    onMarkRead={markAsRead}
                  />
                )}
                {groupedNotifications.older.length > 0 && (
                  <NotificationGroup
                    title="ישן יותר"
                    notifications={groupedNotifications.older}
                    onDismiss={dismissNotification}
                    onMarkRead={markAsRead}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationGroupProps {
  title: string;
  notifications: FeedNotification[];
  onDismiss: (id: string, isPersistent: boolean) => void;
  onMarkRead: (id: string) => void;
}

function NotificationGroup({
  title,
  notifications,
  onDismiss,
  onMarkRead,
}: NotificationGroupProps) {
  return (
    <div>
      <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm px-4 py-2 z-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      </div>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: FeedNotification;
  onDismiss: (id: string, isPersistent: boolean) => void;
  onMarkRead: (id: string) => void;
}

function NotificationItem({ notification, onDismiss, onMarkRead }: NotificationItemProps) {
  const meta = severityMeta[notification.severity] ?? severityMeta.INFO;
  const Icon = meta.icon;
  const timestamp = new Date(notification.timestamp);
  const timeAgo = formatTimeAgo(timestamp);

  return (
    <div
      className={cn(
        'group relative p-4 transition-all hover:bg-gray-50/50',
        !notification.read && 'bg-blue-50/20 border-l-4 border-blue-400'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 rounded-xl p-2.5 shadow-sm',
            meta.bg,
            'border',
            meta.borderColor
          )}
        >
          <Icon className={cn('h-5 w-5', meta.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {notification.category}
                </span>
                {!notification.read && (
                  <span className={cn('h-2 w-2 rounded-full', meta.badgeColor)} />
                )}
              </div>
              <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                {notification.title}
              </h4>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {!notification.read && (
                <button
                  onClick={() => onMarkRead(notification.id)}
                  className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                  aria-label="סמן כנקרא"
                  title="סמן כנקרא"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onDismiss(notification.id, notification.isPersistent)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="הסר התראה"
                title="הסר התראה"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed mb-2">{notification.message}</p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>{timeAgo}</span>
            </div>

            {notification.actionUrl && (
              <a
                href={notification.actionUrl}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                onClick={() => onMarkRead(notification.id)}
              >
                {notification.actionLabel || 'פתח'}
                <span className="text-[10px]">←</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return formatDateTime(d);
}

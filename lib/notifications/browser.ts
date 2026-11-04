'use client';

export const NOTIFICATIONS_REFRESH_EVENT = 'ordex:notifications-refresh';

export function dispatchNotificationsRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}

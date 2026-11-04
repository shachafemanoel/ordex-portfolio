/** Synced with TopNavigation mobile drawer listener. */
export const OPEN_MOBILE_NAV_EVENT_NAME = 'ordex-open-mobile-nav';

export function dispatchOpenMobileNav(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_MOBILE_NAV_EVENT_NAME));
}

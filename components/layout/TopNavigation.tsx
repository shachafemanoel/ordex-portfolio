'use client';

import { SearchModal } from '@/components/layout/SearchModal';
import {
  NavItemConfig,
  getRoleLabel,
  navigationSections,
} from '@/components/layout/navigationConfig';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { UniversalSearch } from '@/components/search/UniversalSearch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocale } from '@/contexts/I18nContext';
import { usePersonalization } from '@/contexts/PersonalizationContext';
import { useRBAC } from '@/hooks/useRBAC';
import { Role } from '@/lib/auth/types';
import { OPEN_MOBILE_NAV_EVENT_NAME } from '@/lib/navigation/mobileNav';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Languages,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  User as UserIcon,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TopNavigationProps {
  className?: string;
}

export function TopNavigation({ className }: TopNavigationProps) {
  const { user, hasPermission, roleKey } = useRBAC();
  const { t } = useUITranslation();
  const { locale, setLocale, direction } = useLocale();
  const { role } = usePersonalization();
  const router = useRouter();
  const pathname = usePathname();
  const isActiveDeliveriesRoute = pathname === '/deliveries/active';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuTriggerId = 'topnav-user-menu-trigger';
  const userMenuContentId = 'topnav-user-menu-content';

  const filterItemsByRole = (items: NavItemConfig[]) =>
    items.filter((item) => item.roles.includes(role));

  const visibleSections = navigationSections
    .map((section) => ({ ...section, items: filterItemsByRole(section.items) }))
    .filter((section) => section.items.length > 0);

  const opsSection = visibleSections.find((s) => s.id === 'ops');
  const managementSection = visibleSections.find((s) => s.id === 'management');
  const toolsSection = visibleSections.find((s) => s.id === 'tools');
  const primaryItems = opsSection?.items ?? [];
  const secondarySections = [managementSection, toolsSection].filter(
    (section): section is NonNullable<typeof section> => Boolean(section)
  );

  const isActive = (path: string) => {
    if (path === '/orders') return pathname === '/orders';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const effectiveRole =
    ((user?.role && typeof user.role === 'object'
      ? (user.role as unknown as Record<string, string>).key
      : user?.role) as Role) ?? ('OPERATIONS' as Role);
  const translatedRole = getRoleLabel(effectiveRole, (key) => t(key));
  const getSectionLabel = (labelKey?: string, fallback?: string) =>
    labelKey ? t(labelKey) : (fallback ?? '');
  const getItemLabel = (item: NavItemConfig) => (item.labelKey ? t(item.labelKey) : item.label);
  const isSectionActive = (items: NavItemConfig[]) => items.some((item) => isActive(item.path));
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Stacked above page content but hidden under an open modal sheet, whose actions sit there.
  const mobileBarZ = 'z-[1040] [body:has([data-app-modal])_&]:hidden';
  const mobileDrawerBackdropZ = 'z-[1048]';
  const mobileDrawerPanelZ = 'z-[1049]';
  const mobileChromeBtnClass =
    'pointer-events-auto rounded-2xl border border-subtle bg-surface/95 shadow-md backdrop-blur-md transition-all active:scale-95';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const openDrawer = () => setMobileMenuOpen(true);
    window.addEventListener(OPEN_MOBILE_NAV_EVENT_NAME, openDrawer);
    return () => window.removeEventListener(OPEN_MOBILE_NAV_EVENT_NAME, openDrawer);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : previousOverflow;
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  // Scroll-aware header: track the main scroll container
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 8);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ── Mobile: split floating controls (hidden on desktop) ── */}
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 px-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]',
          mobileBarZ,
          isActiveDeliveriesRoute ? '' : 'lg:hidden'
        )}
        dir={direction}
      >
        <div className="flex items-start justify-between gap-3">
          {/* RTL: trailing side = visually left — compact actions */}
          <div className="flex flex-col items-start gap-2">
            {hasPermission('CREATE_ORDERS') && (
              <Link
                href="/orders/new"
                className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/25 animate-fade-in-up stagger-1 transition-all active:scale-95 hover:bg-primary-700"
                aria-label={t('actions.newOrder')}
              >
                <Plus className="h-6 w-6 shrink-0 text-white" strokeWidth={2.5} />
              </Link>
            )}
          </div>

          {/* Menu toggle */}
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              className={cn(
                mobileChromeBtnClass,
                'touch-target inline-flex h-12 w-12 items-center justify-center text-fg-muted animate-fade-in-up stagger-1'
              )}
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'סגור תפריט' : 'פתח תפריט'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" strokeWidth={2} />
              ) : (
                <Menu className="h-6 w-6" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop: dynamic header bar (hidden on mobile) ── */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 hidden h-[4.25rem] items-center px-5 backdrop-blur-md lg:flex transition-all duration-200',
          'bg-surface/[0.97]',
          scrolled
            ? 'border-b border-subtle shadow-sm'
            : 'border-b border-transparent',
          isActiveDeliveriesRoute ? 'lg:hidden' : '',
          className
        )}
        dir={direction}
      >
        <div className="flex w-full items-center gap-4">
          {/* Logo */}
          <Link href="/orders" className="flex shrink-0 items-center me-2" aria-label="רצף — הזמנות">
            <BrandLogo height={28} alt="" />
          </Link>

          {/* Vertical divider */}
          <div className="h-6 w-px bg-subtle" />

          {/* Primary nav — pill-button style */}
          <nav className="flex flex-1 items-center gap-1" aria-label="ניווט ראשי">
            {primaryItems.map((item) => {
              const active = isActive(item.path);
              const Icon = active && item.activeIcon ? item.activeIcon : item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold tracking-tight transition-all duration-150',
                    active
                      ? 'bg-primary-50 text-brand shadow-sm'
                      : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      active ? 'text-brand' : 'text-fg-subtle'
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span>{getItemLabel(item)}</span>
                </Link>
              );
            })}

            {secondarySections.length > 0 && (
              <div className="mx-1 h-5 w-px bg-subtle" />
            )}

            {/* Secondary sections — dropdown pill buttons */}
            {secondarySections.map((section) => {
              const sectionActive = isSectionActive(section.items);
              return (
                <DropdownMenu key={section.id}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold tracking-tight transition-all duration-150',
                        sectionActive
                          ? 'bg-primary-50 text-brand shadow-sm'
                          : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
                      )}
                      aria-label={getSectionLabel(section.labelKey, section.label)}
                    >
                      <span>{getSectionLabel(section.labelKey, section.label)}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          sectionActive ? 'text-brand' : 'text-fg-subtle'
                        )}
                        strokeWidth={2.5}
                      />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    className="w-[260px] rounded-2xl border border-subtle bg-surface shadow-lg animate-scale-in"
                  >
                    <DropdownMenuLabel className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                      {getSectionLabel(section.labelKey, section.label)}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-surface-muted" />
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      const Icon = active && item.activeIcon ? item.activeIcon : item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.path}
                          onClick={() => router.push(item.path)}
                          className={cn(
                            'mx-1 my-0.5 cursor-pointer gap-3 rounded-xl text-right font-medium',
                            active && 'bg-primary-50 text-brand'
                          )}
                        >
                          <Icon
                            className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-fg-subtle')}
                            strokeWidth={2}
                          />
                          <div className="min-w-0 flex-1 text-right">
                            <div className="text-sm font-semibold text-fg">{getItemLabel(item)}</div>
                            {item.description ? (
                              <div className="mt-0.5 truncate text-[10px] font-medium text-fg-muted">
                                {item.description}
                              </div>
                            ) : null}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </nav>

          {/* Right section: search + actions */}
          <div className="ms-auto flex items-center gap-2">
            <div className="w-44 xl:w-60">
              <UniversalSearch />
            </div>

            {/* Notifications are frozen for the MVP; their feed API is closed. */}
            <div className="flex items-center gap-1.5 border-s border-subtle ps-3">

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    id={userMenuTriggerId}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-subtle bg-surface-muted transition-all hover:bg-surface active:scale-95 xl:h-auto xl:w-auto xl:gap-2.5 xl:px-3 xl:py-1.5"
                    aria-label="תפריט משתמש"
                    aria-controls={userMenuContentId}
                  >
                    <div className="hidden text-right xl:block">
                      <p className="text-xs font-bold leading-none text-fg">
                        {user?.name || 'GUEST'}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-wide text-fg-muted">
                        {translatedRole}
                      </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white text-xs font-bold shadow-sm xl:h-7 xl:w-7">
                      {user?.name?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                    </div>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-fg-subtle xl:block" strokeWidth={2.5} />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  id={userMenuContentId}
                  aria-labelledby={userMenuTriggerId}
                  align="end"
                  className="w-52 rounded-2xl border border-subtle bg-surface shadow-lg animate-scale-in"
                >
                  <DropdownMenuLabel className="px-4 py-3 text-right">
                    <div className="text-sm font-bold text-fg">{user?.name || 'GUEST'}</div>
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                      {translatedRole}
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator className="bg-surface-muted" />
                  <DropdownMenuItem
                    onClick={() => router.push('/profile')}
                    className="mx-1 my-0.5 cursor-pointer gap-2 rounded-lg text-right font-medium hover:bg-surface-muted"
                  >
                    <UserIcon className="h-4 w-4 text-fg-subtle" strokeWidth={2} />
                    <span>הפרופיל שלי</span>
                  </DropdownMenuItem>
                  {roleKey === 'ADMIN' && (
                    <DropdownMenuItem
                      onClick={() => router.push('/settings/users')}
                      className="mx-1 my-0.5 cursor-pointer gap-2 rounded-lg text-right font-medium hover:bg-surface-muted"
                    >
                      <Settings className="h-4 w-4 text-fg-subtle" strokeWidth={2} />
                      <span>צוות העסק</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => setLocale(locale === 'he' ? 'en' : 'he')}
                    className="mx-1 my-0.5 cursor-pointer gap-2 rounded-lg text-right font-medium hover:bg-surface-muted"
                  >
                    <Languages className="h-4 w-4 text-fg-subtle" strokeWidth={2} />
                    <div className="text-right">
                      <div>שפה</div>
                      <div className="mt-0.5 text-[10px] font-medium text-fg-muted">
                        {locale === 'he' ? 'English' : 'עברית'}
                      </div>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-surface-muted" />
                  <DropdownMenuItem
                    onClick={() => router.push('/api/auth/logout')}
                    className="mx-1 my-0.5 cursor-pointer gap-2 rounded-lg text-right font-medium text-danger focus:bg-[var(--color-danger-50)] focus:text-danger"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={2} />
                    <span>התנתק</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile: full-screen nav drawer ── */}
      <div
        id="mobile-nav-drawer"
        className={cn(
          'fixed inset-0',
          mobileDrawerBackdropZ,
          isActiveDeliveriesRoute ? '' : 'lg:hidden',
          mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        dir={direction}
      >
        <div
          className={cn(
            'absolute inset-0 transition-all duration-300',
            mobileMenuOpen ? 'bg-black/60 backdrop-blur-[2px]' : 'bg-transparent'
          )}
          onClick={closeMobileMenu}
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-label="תפריט ניווט"
          className={cn(
            mobileDrawerPanelZ,
            'absolute inset-y-0 start-0 flex w-[min(90vw,400px)] max-w-full flex-col overflow-hidden border-s border-subtle bg-surface shadow-2xl transition-transform duration-300 ease-out',
            mobileMenuOpen
              ? 'translate-x-0'
              : 'ltr:-translate-x-full rtl:translate-x-full'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Drawer header */}
          <div
            className="relative flex items-center justify-between overflow-hidden border-b border-subtle px-5 pb-5 pt-[calc(env(safe-area-inset-top,0px)+20px)]"
            style={{ background: 'linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-bg-primary) 100%)' }}
          >
            <div className="pointer-events-none absolute -start-8 -top-8 h-32 w-32 rounded-full bg-primary-100/50" />
            <div className="relative flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-600 shadow-md shadow-primary-600/30">
                <span className="text-base font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'O'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-bold tracking-tight text-fg">
                  {user?.name || 'רצף'}
                </div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
                  {translatedRole}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={closeMobileMenu}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-subtle bg-surface/80 text-fg-muted backdrop-blur-sm transition-all active:scale-90 hover:bg-surface shadow-sm"
              aria-label="סגור תפריט"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {/* Drawer quick actions */}
          <div className="flex items-center justify-end gap-2 border-b border-subtle bg-surface-muted/30 px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(true);
                closeMobileMenu();
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-subtle bg-surface text-fg-subtle transition-all active:scale-90 hover:bg-surface-muted hover:text-brand"
              aria-label="חיפוש"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                router.push('/profile');
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-subtle bg-surface text-fg-muted transition-all active:scale-90 hover:bg-surface-muted"
              aria-label="הפרופיל שלי"
            >
              <UserIcon className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>

          {/* Drawer nav sections */}
          <nav className="flex-1 space-y-4 overflow-y-auto p-4">
            {visibleSections.map((section) => (
              <div key={section.id} className="space-y-1">
                <p className="px-2 pb-1 text-[9.5px] font-bold uppercase tracking-[0.2em] text-fg-subtle/70">
                  {getSectionLabel(section.labelKey, section.label)}
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {section.items.map((item, idx) => {
                    const active = isActive(item.path);
                    const Icon = active && item.activeIcon ? item.activeIcon : item.icon;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={closeMobileMenu}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all duration-150 animate-fade-in-up active:scale-[0.98]',
                          active
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                            : 'bg-surface-muted/60 text-fg hover:bg-surface-muted'
                        )}
                        style={{ animationDelay: `${idx * 35 + 60}ms` }}
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-surface text-fg-muted border border-subtle'
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
                        </div>
                        <div className="min-w-0 flex-1 text-right">
                          <div className={cn('text-sm font-bold tracking-tight', active ? 'text-white' : 'text-fg')}>
                            {getItemLabel(item)}
                          </div>
                          {item.description && (
                            <div className={cn('mt-0.5 truncate text-[10px] font-medium', active ? 'text-white/70' : 'text-fg-muted')}>
                              {item.description}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Drawer footer actions */}
            <div className="space-y-2 border-t border-subtle pt-4">
              {hasPermission('CREATE_ORDERS') && (
                <Link
                  href="/orders/new"
                  onClick={closeMobileMenu}
                  className="flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-primary-600 text-white shadow-md shadow-primary-600/25 transition-all active:scale-[0.97] hover:bg-primary-700"
                  aria-label={t('actions.newOrder')}
                >
                  <Plus className="h-5 w-5 shrink-0 text-white" strokeWidth={2.5} />
                  <span className="text-sm font-bold">{t('actions.newOrder')}</span>
                </Link>
              )}

              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => setLocale(locale === 'he' ? 'en' : 'he')}
                  className="flex w-full items-center gap-3 rounded-xl border border-subtle bg-surface px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-muted"
                >
                  <Languages className="h-5 w-5 text-fg-subtle" strokeWidth={2} />
                  <span>שפה: {locale === 'he' ? 'English' : 'עברית'}</span>
                </button>

                {roleKey === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu();
                      router.push('/settings/users');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-subtle bg-surface px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-muted"
                  >
                    <Settings className="h-5 w-5 text-fg-subtle" strokeWidth={2} />
                    <span>צוות העסק</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    router.push('/api/auth/logout');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-danger-500)_25%,transparent)] bg-[var(--color-danger-50)] px-4 py-3 text-sm font-semibold text-danger transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger-50)_85%,var(--color-surface-muted))]"
                >
                  <LogOut className="h-5 w-5" strokeWidth={2} />
                  <span>התנתק</span>
                </button>
              </div>
            </div>
          </nav>
        </aside>
      </div>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}

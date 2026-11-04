'use client';

import { BusinessSwitcher } from '@/components/layout/BusinessSwitcher';
import { BottomNav } from '@/components/layout/BottomNav';
import { TopNavigation } from '@/components/layout/TopNavigation';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell — full-screen layout with dynamic header + scrollable content area.
 *
 * Mobile:  floating top controls + bottom dock nav  (no static header)
 * Desktop: fixed header bar (68px) + scrollable main with gutter padding
 *
 * `/deliveries/active` is a full-bleed route: all chrome is hidden.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isFullBleed = pathname === '/deliveries/active';

  return (
    <div className="app-shell font-sans" dir="rtl">
      <TopNavigation />
      <main
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden scroll-smooth',
          isFullBleed
            ? 'px-0 pt-0 pb-0'
            : [
                // Horizontal gutter (desktop only)
                'px-0 lg:px-[var(--app-shell-gutter)]',
                // Top offset: mobile clears the floating chrome bar (72px + safe area)
                //             desktop clears the fixed header (68px = 4.25rem)
                'pt-[calc(env(safe-area-inset-top,0px)+72px)] lg:pt-[4.25rem]',
                // Bottom offset: mobile clears the floating dock + safe area
                //                desktop just a comfortable gap
                'pb-[max(7rem,calc(7rem+env(safe-area-inset-bottom,0px)))] lg:pb-8',
              ]
        )}
      >
        <div className="app-shell-frame w-full min-h-full">
          {!isFullBleed && <div className="flex justify-end px-4 py-3"><BusinessSwitcher /></div>}
          <Suspense fallback={<LoadingSpinner fullScreen={false} message="טוען עמוד..." />}>
            {children}
          </Suspense>
        </div>
      </main>
      <BottomNav isVisible={!isFullBleed} />
    </div>
  );
}

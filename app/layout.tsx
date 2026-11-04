/* eslint-disable @next/next/no-page-custom-font */

import type { AuthenticatedClientUser } from '@/components/AuthProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { normalizeUser } from '@/domain/users/normalizeUser';
import { I18nProvider } from '@/contexts/I18nContext';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { PersonalizationProvider } from '@/contexts/PersonalizationContext';
import { RouteProgressBar } from '@/components/layout/RouteProgressBar';
import '@/lib/shutdown'; // Register process signal handlers
import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Toaster } from 'sonner';

const metadataBase = (() => {
  const candidate = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  try {
    return new URL(candidate);
  } catch {
    return new URL('http://localhost:3000');
  }
})();

export const metadata: Metadata = {
  title: 'רצף',
  description: 'ניהול לקוחות, הזמנות ותפעול במקום אחד.',
  metadataBase,
  applicationName: 'רצף',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: 'רצף',
    description: 'ניהול לקוחות, הזמנות ותפעול במקום אחד.',
    url: '/',
    siteName: 'רצף',
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'רצף',
  },
};

export const viewport: Viewport = {
  themeColor: '#F8FAFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const serverUser = await getCurrentUser();
  const normalizedServerUser = serverUser ? normalizeUser(serverUser) : null;
  const initialUser: AuthenticatedClientUser | null = normalizedServerUser
    ? {
        ...normalizedServerUser,
        permissions: serverUser?.permissions ?? [],
      }
    : null;

  return (
    <html lang="he" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Load brand fonts for shared token-driven UI */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&family=Public+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />

      </head>
      <body className="font-sans antialiased bg-surface-muted text-fg" suppressHydrationWarning>
        {process.env.RETZEF_DEMO_ENVIRONMENT === 'true' && (
          <div role="status" className="border-b border-subtle bg-surface px-4 py-2 text-center text-sm font-semibold text-fg">
            סביבת הדגמה — נתונים פיקטיביים בלבד. אין להזין פרטי לקוחות אמיתיים או לבצע חיובים.
          </div>
        )}
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <I18nProvider defaultLocale="he">
          <ThemeProvider defaultTheme="light">
            <AuthProvider initialUser={initialUser}>
              <PersonalizationProvider>
                <div className="app-shell-root animate-in fade-in duration-700" suppressHydrationWarning>
                  {children}
                </div>
              </PersonalizationProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
        {/* Top: on phones the bottom belongs to the nav bar and to modal sheet actions. */}
        <Toaster position="top-center" richColors expand closeButton />
        <div id="modal-portal-root" suppressHydrationWarning />
      </body>
    </html>
  );
}

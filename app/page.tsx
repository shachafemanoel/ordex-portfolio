import { getCurrentUser } from '@/lib/auth/verifySession';
import { LandingHeader } from '@/components/marketing/LandingHeader';
import { LandingHero } from '@/components/marketing/LandingHero';
import { LandingFeatures } from '@/components/marketing/LandingFeatures';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/orders');
  }

  return (
    <main dir="rtl" className="relative min-h-screen font-sans">
      <LandingHeader isAuthenticated={!!user} />
      <div className="pt-20 relative z-10">
        <LandingHero />
        <LandingFeatures />
        
        <footer className="mt-24 border-t border-[var(--border-default)] py-8">
          <div className="mx-auto max-w-7xl px-4 text-center text-sm text-[var(--text-secondary)]">
            © {new Date().getFullYear()} רצף. כל הזכויות שמורות.
          </div>
        </footer>
      </div>
    </main>
  );
}

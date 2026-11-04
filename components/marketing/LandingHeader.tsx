import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';

interface LandingHeaderProps {
  isAuthenticated: boolean;
}

export function LandingHeader({ isAuthenticated }: LandingHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border-default)] bg-[var(--surface-card)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex shrink-0 items-center">
            <Link href="/" className="flex items-center gap-2" aria-label="רצף — דף הבית">
              <BrandLogo height={28} alt="" />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard">למערכת</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/login">התחבר</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

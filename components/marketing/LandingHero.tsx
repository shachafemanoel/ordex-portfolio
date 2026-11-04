import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

// Same geometry as design-system/retzef-brand-v2/sources/symbol.svg
const SYMBOL_PATH =
  'M28 188 H68 Q100 188 100 156 V140 Q100 108 132 108 H148 Q180 108 180 76 V60 Q180 28 212 28 H252';

const rise = (delayMs: number) => ({ '--rise-delay': `${delayMs}ms` }) as CSSProperties;

function HeroSymbol() {
  return (
    <svg
      viewBox="0 0 288 224"
      className="h-auto w-40 sm:w-56 lg:w-full lg:max-w-[440px]"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="retzef-hero-orange">
          <rect x="140" y="0" width="148" height="224" />
        </clipPath>
      </defs>
      {[undefined, 'url(#retzef-hero-orange)'].map((clip) => (
        <path
          key={clip ?? 'blue'}
          d={SYMBOL_PATH}
          pathLength={1}
          fill="none"
          strokeWidth={40}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="retzef-draw"
          stroke={clip ? 'var(--color-accent-500)' : 'var(--color-primary-600)'}
          clipPath={clip}
        />
      ))}
    </svg>
  );
}

export function LandingHero() {
  return (
    <section className="bg-surface-muted">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-28">
        <div className="flex justify-center lg:order-last">
          <HeroSymbol />
        </div>

        <div className="space-y-8 text-center lg:text-start">
          <div className="retzef-rise" style={rise(0)}>
            <Badge variant="info" className="mx-auto lg:mx-0">
              גרסה מוקדמת זמינה כעת v1.0
            </Badge>
          </div>

          <h1
            className="retzef-rise text-4xl font-extrabold leading-[1.1] tracking-tight text-fg [font-family:var(--font-display)] sm:text-6xl lg:text-7xl"
            style={rise(80)}
          >
            כל הזמנה.
            <br />
            מהתחלה עד הסוף.
          </h1>

          <p
            className="retzef-rise mx-auto max-w-xl text-lg leading-relaxed text-fg-muted sm:text-xl lg:mx-0"
            style={rise(160)}
          >
            ניהול לקוחות, הזמנות ותפעול במקום אחד. ממשק שמותאם לעבודה בשטח ובנייד, בלי מערכות
            מסורבלות.
          </p>

          <div
            className="retzef-rise flex flex-col items-center gap-5 pt-2 sm:flex-row sm:justify-center lg:justify-start"
            style={rise(240)}
          >
            <Button asChild size="lg" className="group w-full sm:w-auto">
              <Link href="/login" className="inline-flex items-center gap-2">
                <span>התחל עכשיו</span>
                <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </Link>
            </Button>
            <a
              href="#features"
              className="text-base font-semibold text-primary-600 underline-offset-4 hover:underline"
            >
              איך זה עובד?
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

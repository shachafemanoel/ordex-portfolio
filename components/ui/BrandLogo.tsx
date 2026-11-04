import { cn } from '@/lib/utils';

/**
 * Retzef (רצף) brand mark — the only place the logo should be rendered from.
 * Assets live in `public/brand/` and are copied verbatim from design-system/retzef-brand-v2/sources.
 * Rendered as <img> (not inline SVG) so multiple instances don't collide on the SVG clipPath id.
 */

type BrandLogoVariant = 'full' | 'symbol';
type BrandLogoTone = 'color' | 'white' | 'ink';

const ASSETS: Record<BrandLogoVariant, { file: string; width: number; height: number }> = {
  full: { file: 'logo', width: 596, height: 166 },
  symbol: { file: 'symbol', width: 288, height: 224 },
};

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  tone?: BrandLogoTone;
  /** Rendered height in px; width follows the asset's aspect ratio. */
  height?: number;
  alt?: string;
  className?: string;
}

export function BrandLogo({
  variant = 'full',
  tone = 'color',
  height = 28,
  alt = 'רצף',
  className,
}: Readonly<BrandLogoProps>) {
  const asset = ASSETS[variant];
  const suffix = tone === 'color' ? '' : `-${tone}`;
  const width = Math.round((asset.width / asset.height) * height);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimization needed
    <img
      src={`/brand/${asset.file}${suffix}.svg`}
      alt={alt}
      width={width}
      height={height}
      className={cn('block shrink-0 select-none', className)}
      draggable={false}
    />
  );
}

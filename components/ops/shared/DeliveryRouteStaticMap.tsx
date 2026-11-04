'use client';

import { AlertCircle, MapPin, Navigation } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { buildMapboxStaticRouteImageUrl, type StaticMapPoint } from '@/lib/mapbox-static';
import { cn } from '@/lib/utils';

interface DeliveryRouteStaticMapProps {
  accessToken?: string;
  styleId?: string;
  routeCoordinates?: Array<[number, number]>;
  origin?: StaticMapPoint | null;
  nextStop?: StaticMapPoint | null;
  nextStopLabel?: string | null;
  fallbackPoints?: StaticMapPoint[];
  className?: string;
  caption?: string | null;
}

const FALLBACK_STYLE_ID = 'mapbox/streets-v12';

export function DeliveryRouteStaticMap({
  accessToken = '',
  styleId = '',
  routeCoordinates = [],
  origin = null,
  nextStop = null,
  nextStopLabel = null,
  fallbackPoints = [],
  className,
  caption,
}: Readonly<DeliveryRouteStaticMapProps>) {
  const primaryUrl = useMemo(
    () =>
      buildMapboxStaticRouteImageUrl({
        accessToken,
        styleId,
        routeCoordinates,
        origin,
        nextStop,
        nextStopLabel,
        fallbackPoints,
      }),
    [accessToken, fallbackPoints, nextStop, nextStopLabel, origin, routeCoordinates, styleId]
  );

  const fallbackUrl = useMemo(
    () =>
      buildMapboxStaticRouteImageUrl({
        accessToken,
        styleId: FALLBACK_STYLE_ID,
        routeCoordinates,
        origin,
        nextStop,
        nextStopLabel,
        fallbackPoints,
      }),
    [accessToken, fallbackPoints, nextStop, nextStopLabel, origin, routeCoordinates]
  );

  const [displayMode, setDisplayMode] = useState<'primary' | 'fallback' | 'failed'>('primary');

  useEffect(() => {
    setDisplayMode('primary');
  }, [fallbackUrl, primaryUrl]);

  const imageUrl =
    displayMode === 'fallback' ? fallbackUrl : displayMode === 'primary' ? primaryUrl : null;

  if (!imageUrl) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-[26px] border border-subtle bg-static-map-placeholder p-5',
          className
        )}
      >
        <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-translucent-strong text-brand shadow-sm">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="text-sm font-black text-fg">תצוגת מסלול אינה זמינה כרגע</div>
          <div className="max-w-xs text-xs font-semibold leading-5 text-fg-muted">
            {caption || 'חסר מסלול מחושב או הגדרת Mapbox מתאימה להצגת מפת תוואי.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[26px] border border-subtle bg-neutral-mute shadow-[0_18px_44px_-26px_rgba(15,23,42,0.28)]',
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="תצוגה סטטית של המסלול"
        className="h-[220px] w-full object-cover"
        onError={() => {
          if (displayMode === 'primary' && fallbackUrl && fallbackUrl !== primaryUrl) {
            setDisplayMode('fallback');
            return;
          }

          setDisplayMode('failed');
        }}
      />

      {displayMode === 'failed' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-translucent-strong p-5">
          <div className="max-w-xs text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-highlight text-fg-muted">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="mt-3 text-sm font-black text-fg">המפה הסטטית לא נטענה</div>
            <div className="mt-1 text-xs font-semibold text-fg-muted">
              המערכת תמשיך לעבוד גם בלי תמונת מסלול.
            </div>
          </div>
        </div>
      ) : null}

      <div className="map-caption-gradient pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4 pt-10 text-on-inverse">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          {origin ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/22 bg-white/14 px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>מחסן</span>
            </span>
          ) : null}
          {nextStop ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/22 bg-white/14 px-2.5 py-1">
              <Navigation className="h-3.5 w-3.5" />
              <span>העצירה הבאה {nextStopLabel ? `#${nextStopLabel}` : ''}</span>
            </span>
          ) : null}
        </div>
        {caption ? <div className="mt-3 text-xs font-semibold text-white/88">{caption}</div> : null}
      </div>
    </div>
  );
}

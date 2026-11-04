import { NextRequest, NextResponse } from 'next/server';

import {
  buildGeocodeV6ForwardPath,
  fetchMapboxJson,
  getMapboxAccessToken,
  ISRAEL_BBOX,
} from '@/lib/mapbox/server';

export const dynamic = 'force-dynamic';

type MapboxAutocompleteFeature = {
  id: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    full_address?: string;
    name_preferred?: string;
    feature_type?: string;
    context?: {
      place?: { name?: string };
      locality?: { name?: string };
      street?: { name?: string };
      address?: { street_name?: string; address_number?: string };
      postcode?: { name?: string };
      country?: { name?: string };
    };
  };
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!getMapboxAccessToken()) {
    return NextResponse.json(
      { error: 'Maps service not configured' },
      { status: 503 }
    );
  }

  const path = buildGeocodeV6ForwardPath({
    q,
    autocomplete: true,
    limit: 5,
    country: 'IL',
    bbox: ISRAEL_BBOX,
  });

  try {
    const data =
      (await fetchMapboxJson<{ features?: MapboxAutocompleteFeature[] }>(path)) ??
      ({ features: [] } as { features: MapboxAutocompleteFeature[] });
    const features = data.features ?? [];

    const suggestions = features.map((f) => {
      const ctx = f.properties?.context;
      const coords = f.geometry?.coordinates;

      const streetName = ctx?.address?.street_name || ctx?.street?.name || f.properties?.name || '';
      const streetNumber = ctx?.address?.address_number || '';
      const city = ctx?.place?.name || ctx?.locality?.name || '';

      // Build display text
      const mainParts = [streetName, streetNumber].filter(Boolean);
      const mainText = mainParts.join(' ') || f.properties?.name || '';
      const secondaryText = city || f.properties?.full_address || '';

      return {
        id: f.id || `${coords?.[0]}-${coords?.[1]}`,
        mainText,
        secondaryText,
        fullAddress: f.properties?.full_address || '',
        street: streetName,
        streetNumber,
        city,
        postalCode: ctx?.postcode?.name || '',
        country: ctx?.country?.name || '',
        lat: coords?.[1] ?? 0,
        lng: coords?.[0] ?? 0,
      };
    });

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

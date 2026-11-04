import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  buildGeocodeV6ForwardPath,
  fetchMapboxJson,
  getMapboxAccessToken,
  ISRAEL_BBOX,
} from '@/lib/mapbox/server';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  address: z.object({
    regionCode: z.string().optional(),
    locality: z.string(),
    addressLines: z.array(z.string()),
  }),
});

interface MapboxFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    full_address?: string;
    name_preferred?: string;
    context?: {
      place?: { name?: string };
      locality?: { name?: string };
      neighborhood?: { name?: string };
      street?: { name?: string };
      address?: { street_name?: string; address_number?: string };
    };
  };
}

interface MapboxResponse {
  features?: MapboxFeature[];
}

function buildQuery(locality: string, addressLines: string[]): string {
  return [...addressLines, locality, 'ישראל'].filter(Boolean).join(', ');
}

function extractComponents(feature: MapboxFeature, fallback: { locality: string; addressLines: string[] }) {
  const ctx = feature.properties?.context;
  const components: Array<{ componentType: string; componentName: { text: string } }> = [];

  // Locality (city)
  const city =
    ctx?.place?.name ||
    ctx?.locality?.name ||
    fallback.locality;
  if (city) {
    components.push({ componentType: 'locality', componentName: { text: city } });
  }

  // Street (route)
  const street =
    ctx?.address?.street_name ||
    ctx?.street?.name ||
    feature.properties?.name_preferred ||
    '';
  if (street) {
    components.push({ componentType: 'route', componentName: { text: street } });
  }

  // Street number
  const number = ctx?.address?.address_number || '';
  if (number) {
    components.push({ componentType: 'street_number', componentName: { text: number } });
  }

  return components;
}

export async function POST(request: NextRequest) {
  if (!getMapboxAccessToken()) {
    return NextResponse.json(
      { success: false, error: 'Maps service not configured' },
      { status: 503 }
    );
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { address } = body;
  const query = buildQuery(address.locality, address.addressLines);

  const country = (address.regionCode || 'IL').toLowerCase();
  const path = buildGeocodeV6ForwardPath({
    q: query,
    autocomplete: false,
    limit: 1,
    country,
    bbox: ISRAEL_BBOX,
  });

  try {
    const payload = await fetchMapboxJson<MapboxResponse>(path);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Geocoding request failed' },
        { status: 502 }
      );
    }
    const feature = payload.features?.[0];

    if (!feature?.geometry?.coordinates) {
      return NextResponse.json(
        { success: false, error: 'No results found for address' },
        { status: 404 }
      );
    }

    const [lng, lat] = feature.geometry.coordinates;
    const addressComponents = extractComponents(feature, address);

    return NextResponse.json({
      success: true,
      data: {
        address: { addressComponents },
        geocode: {
          location: { latitude: lat, longitude: lng },
        },
      },
    });
  } catch (err) {
    console.error('[maps/validate] Mapbox geocoding error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal geocoding error' },
      { status: 500 }
    );
  }
}

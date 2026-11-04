import { CacheManager } from '@/lib/cache';
import { UNIFIED_ORDER_INCLUDE, mapOrderToUnified, upsertUnifiedOrder } from '@/lib/data/ordersRedis';
import { prisma } from '@/lib/db';
import { ORDER_WITH_RELATIONS_INCLUDE, serializeOrder } from '@/lib/serializers/orderSerializer';
import type { Order as SerializedOrder } from '@/lib/types';
import { OrderStatus } from '@prisma/client';

// Geocoding cache with 24h TTL
const geocodeCache = new CacheManager({
  prefix: 'oms:geocode',
  ttl: 86400, // 24 hours
});

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

// Rate limiting for external API calls
let lastGeocodeMapRequest = 0;
const GEOCODE_MAPS_RATE_LIMIT_MS = 1000; // 1 second between requests for free tier

let lastNominatimRequest = 0;
const NOMINATIM_RATE_LIMIT_MS = 1000; // 1 second between requests (stricter)

// Generate mock coordinates within Israel for development/fallback
function generateMockIsraeliCoordinates(city?: string): GeocodeResult {
  // Major Israeli cities with approximate coordinates
  const cityCoordinates: Record<string, { lat: number; lng: number }> = {
    'תל אביב': { lat: 32.0853, lng: 34.7818 },
    'תל אביב-יפו': { lat: 32.0853, lng: 34.7818 },
    'tel aviv': { lat: 32.0853, lng: 34.7818 },
    ירושלים: { lat: 31.7683, lng: 35.2137 },
    jerusalem: { lat: 31.7683, lng: 35.2137 },
    חיפה: { lat: 32.794, lng: 34.9896 },
    haifa: { lat: 32.794, lng: 34.9896 },
    'ראשון לציון': { lat: 31.973, lng: 34.7925 },
    'petah tikva': { lat: 32.0871, lng: 34.8872 },
    'פתח תקווה': { lat: 32.0871, lng: 34.8872 },
    ashdod: { lat: 31.794, lng: 34.6506 },
    אשדוד: { lat: 31.794, lng: 34.6506 },
    netanya: { lat: 32.3215, lng: 34.8532 },
    נתניה: { lat: 32.3215, lng: 34.8532 },
    'beer sheva': { lat: 31.2518, lng: 34.7913 },
    'באר שבע': { lat: 31.2518, lng: 34.7913 },
  };

  const normalizedCity = city?.toLowerCase().trim();

  // If city is known, use its coordinates with slight randomization
  if (normalizedCity && cityCoordinates[normalizedCity]) {
    const baseCoords = cityCoordinates[normalizedCity];
    return {
      lat: baseCoords.lat + (Math.random() - 0.5) * 0.02, // ±0.01 degree (~1km)
      lng: baseCoords.lng + (Math.random() - 0.5) * 0.02,
      formattedAddress: `Mock coordinates for ${city}, Israel`,
    };
  }

  // Default to Tel Aviv area with randomization
  return {
    lat: 32.0853 + (Math.random() - 0.5) * 0.1, // ±0.05 degree (~5km radius)
    lng: 34.7818 + (Math.random() - 0.5) * 0.1,
    formattedAddress: 'Mock coordinates in Israel (Tel Aviv area)',
  };
}

// Normalize address for consistent caching
function normalizeAddress(address: string, city?: string): string {
  const cleanAddress = address.trim().toLowerCase();
  const cleanCity = city?.trim().toLowerCase() || '';
  return cleanCity ? `${cleanAddress}, ${cleanCity}, israel` : `${cleanAddress}, israel`;
}

// Geocode.maps.co API call
async function geocodeWithGeocodeMapsCo(address: string): Promise<GeocodeResult | null> {
  // Rate limiting for geocode.maps.co (free tier allows 1 request per second)
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodeMapRequest;
  if (timeSinceLastRequest < GEOCODE_MAPS_RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, GEOCODE_MAPS_RATE_LIMIT_MS - timeSinceLastRequest)
    );
  }
  lastGeocodeMapRequest = Date.now();

  try {
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(address)}&format=json&limit=1`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
      headers: {
        'User-Agent': 'Ordex-OMS/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Geocode.maps.co API error: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
      };
    } else {
      console.warn(`No geocoding results found for address: ${address}`);
      return null;
    }
  } catch (error) {
    console.error('Geocode.maps.co API error:', error);
    return null;
  }
}

// Nominatim/OSM Geocoding (fallback)
async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  // Rate limiting (stricter for free service)
  const now = Date.now();
  const timeSinceLastRequest = now - lastNominatimRequest;
  if (timeSinceLastRequest < NOMINATIM_RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, NOMINATIM_RATE_LIMIT_MS - timeSinceLastRequest)
    );
  }
  lastNominatimRequest = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // Reduced timeout to 5 seconds
      headers: {
        'User-Agent': 'Ordex-OMS/1.0 (geocoding)',
      },
    });

    if (!response.ok) {
      console.error(`Nominatim API error: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
      };
    } else {
      console.warn(`No Nominatim results found for address: ${address}`);
      return null;
    }
  } catch (error) {
    console.error('Nominatim API error:', error);
    return null;
  }
}

// Main geocoding function with caching and fallbacks
export async function geocodeAddress(
  address: string,
  city?: string
): Promise<GeocodeResult | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  const normalizedAddress = normalizeAddress(address, city);
  const cacheKey = `addr:${Buffer.from(normalizedAddress).toString('base64')}`;

  try {
    // Check cache first
    const cached = await geocodeCache.get(cacheKey);
    if (cached) {
      console.log(`Geocoding cache hit for: ${normalizedAddress}`);
      return cached;
    }

    console.log(`Geocoding cache miss, fetching: ${normalizedAddress}`);

    // Try Geocode.maps.co first (reliable and free)
    let result = await geocodeWithGeocodeMapsCo(normalizedAddress);

    // Fallback to Nominatim if Geocode.maps.co fails
    if (!result) {
      console.log(`Geocode.maps.co geocoding failed, trying Nominatim for: ${normalizedAddress}`);
      result = await geocodeWithNominatim(normalizedAddress);
    }

    // If both services fail, generate mock coordinates for Israeli addresses
    if (!result) {
      console.log(
        `All geocoding services failed, using mock coordinates for: ${normalizedAddress}`
      );
      result = generateMockIsraeliCoordinates(city);
    }

    // Cache the result (even if null, to avoid repeated failed requests)
    if (result) {
      const ttl = result.formattedAddress?.includes('mock') ? 3600 : 86400; // Shorter cache for mock results
      await geocodeCache.set(cacheKey, result, ttl);
      console.log(`Geocoding result cached for: ${normalizedAddress}`);
    } else {
      await geocodeCache.set(cacheKey, null, 1800); // 30min cache for failed results
      console.warn(`Geocoding completely failed for: ${normalizedAddress}`);
    }

    return result;
  } catch (error) {
    console.error('Geocoding service error:', error);
    return null;
  }
}

// Geocode and persist to Order record
export async function geocodeAndPersistOrder(orderId: string): Promise<boolean> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        city: true,
        addressLine: true,
        shippingAddress: {
          select: {
            street: true,
            number: true,
            city: true,
          },
        },
      },
    });

    if (!order) {
      console.error(`Order not found: ${orderId}`);
      return false;
    }

    if (order.latitude != null && order.longitude != null) {
      console.log(`Order ${orderId} already geocoded`);
      return true;
    }

    const shippingAddress = order.shippingAddress;
    const streetLine = shippingAddress?.street
      ? [shippingAddress.street, shippingAddress.number].filter(Boolean).join(' ')
      : (order.addressLine ?? undefined);
    const city = shippingAddress?.city || order.city || undefined;
    const normalizedStreet = streetLine?.trim();

    if (!normalizedStreet && !city) {
      console.warn(`Unable to geocode order ${orderId}: missing address and city`);
      return false;
    }

    const addressForLookup =
      normalizedStreet && normalizedStreet.length > 0 ? normalizedStreet : city!;

    const result = await geocodeAddress(addressForLookup, city);
    if (result) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          latitude: result.lat,
          longitude: result.lng,
        },
      });

      console.log(`Order ${orderId} geocoded and persisted: ${result.lat}, ${result.lng}`);

      // Sync to Redis
      try {
        const fullOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: UNIFIED_ORDER_INCLUDE,
        });

        if (fullOrder) {
          const unified = mapOrderToUnified(fullOrder);
          await upsertUnifiedOrder(unified);
          console.log(`Order ${orderId} synced to Redis`);
        }
      } catch (redisError) {
        console.error(`Failed to sync geocoded order ${orderId} to Redis:`, redisError);
      }

      return true;
    }

    console.warn(`Failed to geocode order ${orderId}: ${addressForLookup}`);
    return false;
  } catch (error) {
    console.error(`Error geocoding order ${orderId}:`, error);
    return false;
  }
}

// Batch geocode orders (with rate limiting)
export async function batchGeocodeOrders(
  orderIds: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  console.log(`Starting batch geocoding for ${orderIds.length} orders`);

  for (const orderId of orderIds) {
    try {
      const result = await geocodeAndPersistOrder(orderId);
      if (result) {
        success++;
      } else {
        failed++;
      }

      // Small delay to be respectful to external APIs
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Batch geocoding error for order ${orderId}:`, error);
      failed++;
    }
  }

  console.log(`Batch geocoding completed: ${success} success, ${failed} failed`);
  return { success, failed };
}

// Get all orders with coordinates for map display
export async function getOrdersWithCoordinates(
  statusFilter?: string[],
  limit = 100
): Promise<SerializedOrder[]> {
  try {
    const take = Math.min(Math.max(limit, 1), 200);

    const geocodedOrders = await prisma.order.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(statusFilter && statusFilter.length > 0 ? { status: { in: statusFilter as OrderStatus[] } } : {}),
      },
      include: ORDER_WITH_RELATIONS_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take,
    });

    return geocodedOrders.map((order) => serializeOrder(order));
  } catch (error) {
    console.error('Error fetching orders with coordinates:', error);
    return [];
  }
}

// Auto-geocode new orders (for use in order creation hooks)
export async function autoGeocodeNewOrder(orderId: string): Promise<void> {
  try {
    // Run geocoding in the background without blocking the response
    setImmediate(async () => {
      try {
        await geocodeAndPersistOrder(orderId);
      } catch (error) {
        console.error(`Auto-geocoding job failed for order ${orderId}:`, error);
      }
    });
  } catch (error) {
    console.error('Auto-geocoding error:', error);
  }
}

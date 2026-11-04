import { databaseTenantId } from '@/lib/tenancy/context';
/**
 * Geocoding Cache Service
 * Stores geocoding results in database to avoid duplicate API calls
 */

import { prisma } from '@/lib/prisma';

export interface GeocodingResult {
  lat: number;
  lng: number;
  placeId?: string;
  formattedAddress?: string;
}

/**
 * Normalize address for cache lookup
 * Removes extra spaces, converts to lowercase for consistent matching
 */
function normalizeAddress(address: string, city?: string): string {
  const fullAddress = city ? `${address}, ${city}` : address;
  return fullAddress
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[,،]+/g, ',') // Normalize commas
    .trim();
}

/**
 * Get geocoding result from cache
 */
export async function getFromCache(
  address: string,
  city?: string
): Promise<GeocodingResult | null> {
  try {
    const normalizedAddress = normalizeAddress(address, city);

    const cached = await prisma.geocodingCache.findFirst({
      where: { address: normalizedAddress },
    });

    if (!cached) {
      return null;
    }

    console.log(`✅ Cache HIT for: ${normalizedAddress}`);

    return {
      lat: cached.lat,
      lng: cached.lng,
      placeId: cached.placeId || undefined,
      formattedAddress: (cached.data as any)?.formattedAddress,
    };
  } catch (error) {
    console.error('Error reading from geocoding cache:', error);
    return null;
  }
}

/**
 * Store geocoding result in cache
 */
export async function saveToCache(
  address: string,
  city: string | undefined,
  result: GeocodingResult
): Promise<void> {
  try {
    const normalizedAddress = normalizeAddress(address, city);

    await prisma.geocodingCache.upsert({
      where: { tenantId_address: { tenantId: await databaseTenantId(), address: normalizedAddress } },
      create: {
        address: normalizedAddress,
        lat: result.lat,
        lng: result.lng,
        placeId: result.placeId,
        data: {
          formattedAddress: result.formattedAddress,
          originalAddress: address,
          originalCity: city,
        },
      },
      update: {
        lat: result.lat,
        lng: result.lng,
        placeId: result.placeId,
        data: {
          formattedAddress: result.formattedAddress,
          originalAddress: address,
          originalCity: city,
        },
      },
    });

    console.log(`💾 Saved to cache: ${normalizedAddress}`);
  } catch (error) {
    console.error('Error saving to geocoding cache:', error);
    // Don't throw - cache failures shouldn't break geocoding
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> {
  try {
    const [totalEntries, oldest, newest] = await Promise.all([
      prisma.geocodingCache.count(),
      prisma.geocodingCache.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.geocodingCache.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      totalEntries,
      oldestEntry: oldest?.createdAt || null,
      newestEntry: newest?.createdAt || null,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalEntries: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }
}

/**
 * Clear old cache entries (older than specified days)
 */
export async function clearOldCacheEntries(olderThanDays: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.geocodingCache.deleteMany({
      where: {
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`🗑️ Cleared ${result.count} old cache entries`);
    return result.count;
  } catch (error) {
    console.error('Error clearing old cache entries:', error);
    return 0;
  }
}

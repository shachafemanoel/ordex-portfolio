/**
 * Geocoding utilities for addresses and city-based map centering
 */

// Known city coordinates in Israel for quick centering
export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'תל אביב': { lat: 32.0853, lng: 34.7818 },
  ירושלים: { lat: 31.7683, lng: 35.2137 },
  חיפה: { lat: 32.794, lng: 34.9896 },
  'באר שבע': { lat: 31.253, lng: 34.7915 },
  'רמת גן': { lat: 32.082, lng: 34.8247 },
  'בני ברק': { lat: 32.0804, lng: 34.8338 },
  נתניה: { lat: 32.3215, lng: 34.8532 },
  חולון: { lat: 32.0117, lng: 34.775 },
  רחובות: { lat: 31.8947, lng: 34.8083 },
  אשדוד: { lat: 31.7943, lng: 34.6558 },
  'פתח תקווה': { lat: 32.087, lng: 34.8874 },
  'ראשון לציון': { lat: 31.9641, lng: 34.805 },
  'כפר סבא': { lat: 32.1749, lng: 34.9079 },
  הרצליה: { lat: 32.1661, lng: 34.8438 },
  אשקלון: { lat: 31.6688, lng: 34.5656 },
  גבעתיים: { lat: 32.0707, lng: 34.8115 },
  רעננה: { lat: 32.1848, lng: 34.8719 },
  מודיעין: { lat: 31.8969, lng: 35.0093 },
  עפולה: { lat: 32.6084, lng: 35.2917 },
  נצרת: { lat: 32.7022, lng: 35.2987 },
  טבריה: { lat: 32.7922, lng: 35.5353 },
  'כפר שמריהו': { lat: 32.1886, lng: 34.8226 },
};

/**
 * Default center point for Israel
 */
export const ISRAEL_CENTER = { lat: 31.5, lng: 34.75 };

/**
 * Get coordinates for a city name (fuzzy match)
 */
export function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  if (!cityName) return null;

  // Exact match
  if (CITY_COORDINATES[cityName]) {
    return CITY_COORDINATES[cityName];
  }

  // Fuzzy match - check if city contains the search term or vice versa
  const searchLower = cityName.toLowerCase();
  const matchedCity = Object.keys(CITY_COORDINATES).find(
    (city) => city.toLowerCase().includes(searchLower) || searchLower.includes(city.toLowerCase())
  );

  return matchedCity ? CITY_COORDINATES[matchedCity] : null;
}

/**
 * Calculate center point from array of coordinates
 */
export function calculateCenterPoint(coordinates: Array<{ lat: number; lng: number }>): {
  lat: number;
  lng: number;
} {
  if (!coordinates || coordinates.length === 0) {
    return ISRAEL_CENTER;
  }

  if (coordinates.length === 1) {
    return coordinates[0];
  }

  const totals = coordinates.reduce(
    (acc, coord) => ({
      lat: acc.lat + coord.lat,
      lng: acc.lng + coord.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: totals.lat / coordinates.length,
    lng: totals.lng / coordinates.length,
  };
}

/**
 * Get user's current geolocation
 */
export async function getUserLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) {
    console.warn('[Geolocation] Not supported in this browser');
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        // Don't spam console with geolocation errors - they're expected if user denies permission
        if (error.code === error.PERMISSION_DENIED) {
          console.info('[Geolocation] Permission denied by user');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.warn('[Geolocation] Position unavailable');
        } else if (error.code === error.TIMEOUT) {
          console.warn('[Geolocation] Request timeout');
        }
        resolve(null);
      },
      {
        timeout: 5000,
        maximumAge: 60000, // Cache for 1 minute
        enableHighAccuracy: false, // Don't require GPS, WiFi/IP is fine
      }
    );
  });
}

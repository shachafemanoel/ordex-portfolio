import { geocodeAddress } from '@/lib/geocodingService';

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface GeocodingProvider {
  geocode(address: string, city?: string): Promise<GeocodingResult | null>;
}

export const geocodingProvider: GeocodingProvider = {
  async geocode(address: string, city?: string) {
    return geocodeAddress(address, city);
  },
};

import { geocodeAddress } from '@/lib/geocodingService';
import { MapService } from '@/lib/services/map/MapService';

export class GeocodingService extends MapService {
  async geocodeAddress(address: string, city?: string) {
    return geocodeAddress(address, city);
  }
}

// Alias for backwards compatibility within ServiceFactory
export { GeocodingService as GoogleMapsService };

import { geocodeAndPersistOrder } from '@/lib/geocodingService';

export class GeminiGeocodingService {
  async geocodeOrder(orderId: string) {
    const success = await geocodeAndPersistOrder(orderId);
    return { success };
  }
}

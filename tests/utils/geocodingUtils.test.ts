import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCityCoordinates,
  calculateCenterPoint,
  getUserLocation,
  CITY_COORDINATES,
  ISRAEL_CENTER,
} from '@/lib/utils/geocodingUtils';

describe('geocodingUtils', () => {
  describe('getCityCoordinates', () => {
    it('returns null for an empty string', () => {
      expect(getCityCoordinates('')).toBeNull();
    });

    it('returns coordinates for an exact city name match', () => {
      const city = 'תל אביב';
      expect(getCityCoordinates(city)).toEqual(CITY_COORDINATES[city]);
    });

    it('returns coordinates for a partial match (substring of city)', () => {
      expect(getCityCoordinates('תל')).toEqual(CITY_COORDINATES['תל אביב']);
    });

    it('returns coordinates for a partial match (city is substring of input)', () => {
      expect(getCityCoordinates('תל אביב יפו')).toEqual(CITY_COORDINATES['תל אביב']);
    });

    it('returns null for a non-existent city', () => {
      expect(getCityCoordinates('עיר לא קיימת')).toBeNull();
    });
  });

  describe('calculateCenterPoint', () => {
    it('returns ISRAEL_CENTER for an empty array', () => {
      expect(calculateCenterPoint([])).toEqual(ISRAEL_CENTER);
    });

    it('returns ISRAEL_CENTER for null input', () => {
      // @ts-ignore - testing runtime behavior
      expect(calculateCenterPoint(null)).toEqual(ISRAEL_CENTER);
    });

    it('returns the coordinate for a single point array', () => {
      const coords = [{ lat: 32.1, lng: 34.8 }];
      expect(calculateCenterPoint(coords)).toEqual(coords[0]);
    });

    it('returns the average coordinate for multiple points', () => {
      const coords = [
        { lat: 32.0, lng: 34.0 },
        { lat: 33.0, lng: 35.0 },
      ];
      expect(calculateCenterPoint(coords)).toEqual({ lat: 32.5, lng: 34.5 });
    });
  });

  describe('getUserLocation', () => {
    let originalNavigator: any;

    beforeEach(() => {
      originalNavigator = global.navigator;
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      if (originalNavigator === undefined) {
        // @ts-ignore
        delete global.navigator;
      } else {
        global.navigator = originalNavigator;
      }
      vi.restoreAllMocks();
    });

    it('returns coordinates when geolocation is successful', async () => {
      const lat = 32.0853;
      const lng = 34.7818;
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success) =>
          success({
            coords: {
              latitude: lat,
              longitude: lng,
            },
          })
        ),
      };

      global.navigator = { geolocation: mockGeolocation } as any;

      const location = await getUserLocation();
      expect(location).toEqual({
        lat,
        lng,
      });
    });

    it('returns null when geolocation is not supported', async () => {
      global.navigator = {} as any;
      const location = await getUserLocation();
      expect(location).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Not supported'));
    });

    it('returns null when permission is denied', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success, error) =>
          error({
            code: 1, // PERMISSION_DENIED
            PERMISSION_DENIED: 1,
          })
        ),
      };

      global.navigator = { geolocation: mockGeolocation } as any;

      const location = await getUserLocation();
      expect(location).toBeNull();
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
    });

    it('returns null when position is unavailable', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success, error) =>
          error({
            code: 2, // POSITION_UNAVAILABLE
            POSITION_UNAVAILABLE: 2,
          })
        ),
      };

      global.navigator = { geolocation: mockGeolocation } as any;

      const location = await getUserLocation();
      expect(location).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Position unavailable'));
    });

    it('returns null when request timeouts', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success, error) =>
          error({
            code: 3, // TIMEOUT
            TIMEOUT: 3,
          })
        ),
      };

      global.navigator = { geolocation: mockGeolocation } as any;

      const location = await getUserLocation();
      expect(location).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Request timeout'));
    });
  });
});

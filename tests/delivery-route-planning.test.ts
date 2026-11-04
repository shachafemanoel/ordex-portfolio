import { describe, expect, it } from 'vitest';

import {
  getOperationalRouteLimitMinutes,
  pickAutoDeferredCandidateIds,
  splitPlanningItemsIntoZones,
} from '@/lib/delivery-route-planning';
import {
  getBusinessDayDateKey,
  getZonedTimeString,
  shiftZonedDateByDays,
} from '@/lib/store-business-hours';

describe('delivery route planning', () => {
  it('caps the operational route limit at 10 hours or the business-day length', () => {
    expect(
      getOperationalRouteLimitMinutes({
        businessDayStartTime: '09:00',
        businessDayEndTime: '21:00',
      })
    ).toBe(600);

    expect(
      getOperationalRouteLimitMinutes({
        businessDayStartTime: '09:00',
        businessDayEndTime: '18:00',
      })
    ).toBe(540);
  });

  it('defers the farthest movable deliveries before closer or already-active stops', () => {
    const candidateIds = pickAutoDeferredCandidateIds([
      {
        id: 'in-transit',
        status: 'IN_TRANSIT',
        scheduledAt: '2026-03-24T07:00:00.000Z',
        originDistanceKm: 42,
        serviceMinutes: 60,
      },
      {
        id: 'far',
        status: 'SCHEDULED',
        scheduledAt: '2026-03-24T07:00:00.000Z',
        originDistanceKm: 38,
        serviceMinutes: 60,
      },
      {
        id: 'mid',
        status: 'READY',
        scheduledAt: '2026-03-24T08:00:00.000Z',
        originDistanceKm: 21,
        serviceMinutes: 60,
      },
      {
        id: 'no-coords',
        status: 'SCHEDULED',
        scheduledAt: '2026-03-24T09:00:00.000Z',
        originDistanceKm: null,
        serviceMinutes: 90,
      },
    ]);

    expect(candidateIds).toEqual(['far', 'mid', 'no-coords']);
  });

  it('shifts rebalanced deliveries to the next day without changing the local clock time', () => {
    const shifted = shiftZonedDateByDays(new Date('2026-03-24T07:00:00.000Z'), 'Asia/Jerusalem', 1);

    expect(getBusinessDayDateKey(shifted, 'Asia/Jerusalem')).toBe('2026-03-25');
    expect(getZonedTimeString(shifted, 'Asia/Jerusalem')).toBe('09:00');
  });

  it('splits deliveries into distance-based zones for multiple workers', () => {
    const zones = splitPlanningItemsIntoZones(
      [
        {
          id: 'north-1',
          lat: 32.11,
          lng: 34.8,
          serviceMinutes: 60,
          originDistanceKm: 12,
          scheduledAt: null,
        },
        {
          id: 'north-2',
          lat: 32.12,
          lng: 34.82,
          serviceMinutes: 60,
          originDistanceKm: 13,
          scheduledAt: null,
        },
        {
          id: 'south-1',
          lat: 31.78,
          lng: 34.76,
          serviceMinutes: 60,
          originDistanceKm: 18,
          scheduledAt: null,
        },
        {
          id: 'south-2',
          lat: 31.77,
          lng: 34.75,
          serviceMinutes: 60,
          originDistanceKm: 17,
          scheduledAt: null,
        },
      ],
      2,
      { lat: 31.99, lng: 34.77 }
    );

    expect(zones).toHaveLength(2);
    expect(zones.flat().sort()).toEqual(['north-1', 'north-2', 'south-1', 'south-2']);
    expect(zones.some((zone) => zone.includes('north-1') && zone.includes('north-2'))).toBe(true);
    expect(zones.some((zone) => zone.includes('south-1') && zone.includes('south-2'))).toBe(true);
  });

  it('builds compact bundles of 2-3 deliveries without leaving a single-stop route', () => {
    const zones = splitPlanningItemsIntoZones(
      [
        {
          id: 'north-1',
          city: 'חיפה',
          lat: 32.82,
          lng: 34.99,
          serviceMinutes: 60,
          originDistanceKm: 95,
          scheduledAt: null,
        },
        {
          id: 'north-2',
          city: 'חיפה',
          lat: 32.81,
          lng: 35.01,
          serviceMinutes: 60,
          originDistanceKm: 94,
          scheduledAt: null,
        },
        {
          id: 'north-3',
          city: 'קריות',
          lat: 32.84,
          lng: 35.05,
          serviceMinutes: 60,
          originDistanceKm: 98,
          scheduledAt: null,
        },
        {
          id: 'center-1',
          city: 'תל אביב',
          lat: 32.07,
          lng: 34.78,
          serviceMinutes: 60,
          originDistanceKm: 16,
          scheduledAt: null,
        },
        {
          id: 'center-2',
          city: 'רמת גן',
          lat: 32.08,
          lng: 34.81,
          serviceMinutes: 60,
          originDistanceKm: 18,
          scheduledAt: null,
        },
        {
          id: 'south-1',
          city: 'אשדוד',
          lat: 31.8,
          lng: 34.65,
          serviceMinutes: 60,
          originDistanceKm: 42,
          scheduledAt: null,
        },
        {
          id: 'south-2',
          city: 'אשקלון',
          lat: 31.67,
          lng: 34.57,
          serviceMinutes: 60,
          originDistanceKm: 55,
          scheduledAt: null,
        },
      ],
      3,
      { lat: 31.99, lng: 34.77 }
    );

    expect(zones).toHaveLength(3);
    expect(zones.flat().sort()).toEqual([
      'center-1',
      'center-2',
      'north-1',
      'north-2',
      'north-3',
      'south-1',
      'south-2',
    ]);
    expect(zones.every((zone) => zone.length >= 2 && zone.length <= 3)).toBe(true);
    expect(
      zones.some(
        (zone) => zone.includes('north-1') && zone.includes('north-2') && zone.includes('north-3')
      )
    ).toBe(true);
  });
});

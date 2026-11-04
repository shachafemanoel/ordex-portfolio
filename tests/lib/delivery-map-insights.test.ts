import { describe, expect, it } from 'vitest';

import { buildDeliveryMapHotspots, buildDeliveryMapInsights } from '@/lib/delivery-map-insights';

describe('delivery-map-insights', () => {
  it('groups hotspot clusters by route group and prioritizes overdue stops', () => {
    const hotspots = buildDeliveryMapHotspots(
      [
        {
          id: 'a',
          status: 'SCHEDULED',
          city: 'תל אביב',
          scheduledAt: '2026-03-27T08:00:00.000Z',
          lat: 32.08,
          lng: 34.78,
          groupId: 'north-core',
          groupLabel: 'מרכז צפון',
          groupColor: '#12b981',
          routeBucket: 'today',
        },
        {
          id: 'b',
          status: 'IN_TRANSIT',
          city: 'תל אביב',
          scheduledAt: '2026-03-28T10:00:00.000Z',
          lat: 32.09,
          lng: 34.79,
          groupId: 'north-core',
          groupLabel: 'מרכז צפון',
          groupColor: '#12b981',
          routeBucket: 'today',
        },
        {
          id: 'c',
          status: 'READY',
          city: 'חיפה',
          scheduledAt: '2026-03-28T12:00:00.000Z',
          lat: 32.8,
          lng: 34.98,
          routeBucket: 'today',
        },
      ],
      {
        now: new Date('2026-03-28T09:30:00.000Z'),
      }
    );

    expect(hotspots).toHaveLength(2);
    expect(hotspots[0]).toMatchObject({
      label: 'מרכז צפון',
      count: 2,
      overdueCount: 1,
      inTransitCount: 1,
      color: '#12b981',
    });
    expect(hotspots[0].score).toBeGreaterThan(hotspots[1].score);
  });

  it('falls back to city-based hotspots when there is no route grouping', () => {
    const hotspots = buildDeliveryMapHotspots([
      {
        id: 'a',
        status: 'SCHEDULED',
        city: 'ירושלים',
        scheduledAt: '2026-03-28T08:00:00.000Z',
        lat: 31.78,
        lng: 35.22,
      },
      {
        id: 'b',
        status: 'READY_FOR_INSTALL',
        city: 'ירושלים',
        scheduledAt: '2026-03-28T11:00:00.000Z',
        lat: 31.79,
        lng: 35.23,
      },
    ]);

    expect(hotspots).toHaveLength(1);
    expect(hotspots[0]).toMatchObject({
      label: 'ירושלים',
      count: 2,
    });
  });

  it('builds delivery map insights from route pressure and hotspot data', () => {
    const hotspots = buildDeliveryMapHotspots(
      [
        {
          id: 'a',
          status: 'SCHEDULED',
          city: 'אשדוד',
          scheduledAt: '2026-03-27T07:00:00.000Z',
          lat: 31.8,
          lng: 34.64,
        },
        {
          id: 'b',
          status: 'INSTALLATION',
          city: 'אשדוד',
          scheduledAt: '2026-03-28T10:00:00.000Z',
          lat: 31.81,
          lng: 34.65,
        },
      ],
      {
        now: new Date('2026-03-28T09:30:00.000Z'),
      }
    );

    const insights = buildDeliveryMapInsights({
      items: [
        {
          id: 'a',
          status: 'SCHEDULED',
          city: 'אשדוד',
          scheduledAt: '2026-03-27T07:00:00.000Z',
          lat: 31.8,
          lng: 34.64,
        },
        {
          id: 'b',
          status: 'INSTALLATION',
          city: 'אשדוד',
          scheduledAt: '2026-03-28T10:00:00.000Z',
          lat: 31.81,
          lng: 34.65,
        },
      ],
      hotspots,
      routeSummary: {
        geocodedCount: 2,
        routeStopCount: 2,
        routeDurationMinutes: 145,
        routeDistanceKm: 48.6,
        deferredStopCount: 1,
        deferredDateKey: '2026-03-29',
        activeWorkerCount: 2,
      },
      routeLabel: 'חלוקה אזורית',
      totalRoutes: 2,
    });

    expect(insights).toEqual([
      {
        id: 'deferred',
        label: 'גלישה',
        value: '1 עצירות ל-29.03',
        tone: 'warning',
      },
      {
        id: 'hotspot',
        label: 'אזור חם',
        value: 'אשדוד • 2 עצירות • 1 באיחור',
        tone: 'danger',
      },
      {
        id: 'route',
        label: 'מסלולים מומלצים',
        value: "חלוקה אזורית • 2 עצירות • 2 ש' 25 דק' • 48.6 ק\"מ • 2 מסלולים",
        tone: 'info',
      },
      {
        id: 'coverage',
        label: 'כיסוי מפה',
        value: '2/2 נקודות',
        tone: 'success',
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildScheduleRecommendationScore,
  buildSmartScheduleWindowOptions,
  estimateScheduleInsertionMinutes,
} from '@/lib/orders/smartSchedule';

describe('smart schedule recommendations', () => {
  it('builds route-friendly windows from business hours', () => {
    expect(
      buildSmartScheduleWindowOptions({
        businessDayStartTime: '09:00',
        businessDayEndTime: '18:00',
      })
    ).toEqual([
      {
        value: '09:00-12:00',
        label: 'בוקר • 09:00-12:00',
        start: '09:00',
        end: '12:00',
        part: 'morning',
      },
      {
        value: '12:00-15:00',
        label: 'אמצע יום • 12:00-15:00',
        start: '12:00',
        end: '15:00',
        part: 'midday',
      },
      {
        value: '15:00-18:00',
        label: 'אחר הצהריים • 15:00-18:00',
        start: '15:00',
        end: '18:00',
        part: 'afternoon',
      },
    ]);
  });

  it('keeps windows continuous even when the business day is shorter than 9 hours', () => {
    const windows = buildSmartScheduleWindowOptions({
      businessDayStartTime: '09:00',
      businessDayEndTime: '17:00',
    });

    expect(windows).toHaveLength(3);
    expect(windows[0]?.start).toBe('09:00');
    expect(windows[2]?.end).toBe('17:00');
    expect(windows[0]?.end).toBe(windows[1]?.start);
    expect(windows[1]?.end).toBe(windows[2]?.start);
  });

  it('prefers clustered nearby slots over distant or isolated ones', () => {
    const closeInsertion = estimateScheduleInsertionMinutes({
      nearestClusterDistanceKm: 2.1,
      candidateOriginDistanceKm: 10,
      sameDayStopCount: 4,
      sameWindowStopCount: 2,
    });
    const farInsertion = estimateScheduleInsertionMinutes({
      nearestClusterDistanceKm: 18,
      candidateOriginDistanceKm: 10,
      sameDayStopCount: 1,
      sameWindowStopCount: 0,
    });

    const closeScore = buildScheduleRecommendationScore({
      dayOffset: 1,
      windowPart: 'midday',
      sameDayStopCount: 4,
      sameWindowStopCount: 2,
      nearestClusterDistanceKm: 2.1,
      projectedWorkloadMinutes: 360,
      remainingCapacityMinutes: 180,
      capacityLimitMinutes: 540,
    });
    const farScore = buildScheduleRecommendationScore({
      dayOffset: 1,
      windowPart: 'afternoon',
      sameDayStopCount: 1,
      sameWindowStopCount: 0,
      nearestClusterDistanceKm: 18,
      projectedWorkloadMinutes: 410,
      remainingCapacityMinutes: 130,
      capacityLimitMinutes: 540,
    });

    expect(closeInsertion).toBeLessThan(farInsertion);
    expect(closeScore).toBeLessThan(farScore);
  });
});

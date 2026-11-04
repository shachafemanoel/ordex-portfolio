import {
  formatMinutesAsTimeString,
  getBusinessDayDurationMinutes,
  parseTimeStringToMinutes,
  type StoreBusinessHours,
} from '@/lib/store-business-hours';

export type SmartScheduleWindowPart = 'morning' | 'midday' | 'afternoon';

export type SmartScheduleWindowOption = {
  value: string;
  label: string;
  start: string;
  end: string;
  part: SmartScheduleWindowPart;
};

export type SmartScheduleRecommendation = {
  id: string;
  title: string;
  hint: string;
  dateValue: string;
  windowValue: string;
  windowLabel: string;
  windowStart: string;
  windowEnd: string;
  part: SmartScheduleWindowPart;
  loadCount: number;
  dayLoadCount: number;
  nearestClusterDistanceKm: number | null;
  projectedWorkloadMinutes: number;
  remainingCapacityMinutes: number;
  insertionMinutes: number;
  score: number;
};

export type SmartScheduleManualWindow = {
  value: string;
  label: string;
  start: string;
  end: string;
  loadCount: number;
  dayLoadCount: number;
  nearestClusterDistanceKm: number | null;
  projectedWorkloadMinutes: number;
  remainingCapacityMinutes: number;
  insertionMinutes: number;
  disabled: boolean;
  reason: string | null;
  isRecommended: boolean;
};

export type SmartScheduleManualDateOption = {
  dateValue: string;
  windowOptions: SmartScheduleManualWindow[];
};

function roundToNearestThirty(minutes: number) {
  return Math.round(minutes / 30) * 30;
}

function getWindowPart(index: number, count: number): SmartScheduleWindowPart {
  if (count <= 1) return 'midday';
  if (count === 2) {
    return index === 0 ? 'morning' : 'afternoon';
  }
  if (index === 0) return 'morning';
  if (index === count - 1) return 'afternoon';
  return 'midday';
}

function getWindowPartLabel(part: SmartScheduleWindowPart) {
  switch (part) {
    case 'morning':
      return 'בוקר';
    case 'midday':
      return 'אמצע יום';
    case 'afternoon':
      return 'אחר הצהריים';
  }
}

export function buildSmartScheduleWindowOptions(
  settings: Pick<StoreBusinessHours, 'businessDayStartTime' | 'businessDayEndTime'>
): SmartScheduleWindowOption[] {
  const startMinutes = parseTimeStringToMinutes(settings.businessDayStartTime);
  const endMinutes = parseTimeStringToMinutes(settings.businessDayEndTime);
  const durationMinutes = getBusinessDayDurationMinutes(settings);

  if (durationMinutes <= 0) {
    return [];
  }

  const segmentCount = durationMinutes >= 450 ? 3 : durationMinutes >= 240 ? 2 : 1;
  const boundaries = [startMinutes];

  for (let index = 1; index < segmentCount; index += 1) {
    const proportionalBoundary = startMinutes + (durationMinutes * index) / segmentCount;
    const remainingSegments = segmentCount - index;
    const minBoundary = boundaries[index - 1] + 90;
    const maxBoundary = endMinutes - remainingSegments * 90;
    const nextBoundary = Math.max(
      minBoundary,
      Math.min(maxBoundary, roundToNearestThirty(proportionalBoundary))
    );

    boundaries.push(nextBoundary);
  }

  boundaries.push(endMinutes);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const part = getWindowPart(index, segmentCount);
    const startValue = formatMinutesAsTimeString(start);
    const endValue = formatMinutesAsTimeString(end);

    return {
      value: `${startValue}-${endValue}`,
      label: `${getWindowPartLabel(part)} • ${startValue}-${endValue}`,
      start: startValue,
      end: endValue,
      part,
    };
  });
}

export function matchSmartScheduleWindow(
  timeValue: string,
  windowOptions: SmartScheduleWindowOption[]
): SmartScheduleWindowOption | null {
  const timeMinutes = parseTimeStringToMinutes(timeValue);

  return (
    windowOptions.find((windowOption, index) => {
      const startMinutes = parseTimeStringToMinutes(windowOption.start);
      const endMinutes = parseTimeStringToMinutes(windowOption.end);
      const isLast = index === windowOptions.length - 1;

      return isLast
        ? timeMinutes >= startMinutes && timeMinutes <= endMinutes
        : timeMinutes >= startMinutes && timeMinutes < endMinutes;
    }) ?? null
  );
}

export function estimateScheduleInsertionMinutes(input: {
  nearestClusterDistanceKm: number | null;
  candidateOriginDistanceKm: number | null;
  sameDayStopCount: number;
  sameWindowStopCount: number;
}) {
  if (typeof input.nearestClusterDistanceKm === 'number' && Number.isFinite(input.nearestClusterDistanceKm)) {
    const multiplier = input.sameWindowStopCount > 0 ? 2.2 : 3.4;
    const baseMinutes = input.sameDayStopCount > 0 ? 12 : 18;
    return baseMinutes + Math.round(input.nearestClusterDistanceKm * multiplier);
  }

  if (typeof input.candidateOriginDistanceKm === 'number' && Number.isFinite(input.candidateOriginDistanceKm)) {
    return 20 + Math.round(input.candidateOriginDistanceKm * 2.6);
  }

  return input.sameDayStopCount > 0 ? 28 : 36;
}

export function buildScheduleRecommendationScore(input: {
  dayOffset: number;
  windowPart: SmartScheduleWindowPart;
  sameDayStopCount: number;
  sameWindowStopCount: number;
  nearestClusterDistanceKm: number | null;
  projectedWorkloadMinutes: number;
  remainingCapacityMinutes: number;
  capacityLimitMinutes: number;
}) {
  const windowPenalty = input.windowPart === 'midday' ? 0 : input.windowPart === 'morning' ? 3 : 7;
  const proximityPenalty =
    typeof input.nearestClusterDistanceKm === 'number'
      ? Math.round(
          Math.min(
            90,
            input.nearestClusterDistanceKm * (input.sameWindowStopCount > 0 ? 2.4 : 4.6)
          )
        )
      : 18;
  const utilizationPenalty =
    input.capacityLimitMinutes > 0
      ? Math.round((input.projectedWorkloadMinutes / input.capacityLimitMinutes) * 38)
      : 38;
  const dayPenalty = input.dayOffset * 22;
  const sparseRoutePenalty = input.sameDayStopCount === 0 ? 14 : 0;
  const loadPenalty = Math.max(0, input.sameWindowStopCount - 1) * 5;
  const clusterBonus = Math.min(14, input.sameWindowStopCount * 4);
  const slackPenalty =
    input.remainingCapacityMinutes < 0
      ? 500 + Math.abs(input.remainingCapacityMinutes)
      : Math.max(0, 10 - Math.floor(input.remainingCapacityMinutes / 30));

  return (
    dayPenalty +
    windowPenalty +
    proximityPenalty +
    utilizationPenalty +
    sparseRoutePenalty +
    loadPenalty +
    slackPenalty -
    clusterBonus
  );
}

export function buildScheduleRecommendationCopy(input: {
  dayOffset: number;
  sameDayStopCount: number;
  sameWindowStopCount: number;
  nearestClusterDistanceKm: number | null;
  remainingCapacityMinutes: number;
}) {
  if (
    input.sameWindowStopCount > 0 &&
    typeof input.nearestClusterDistanceKm === 'number' &&
    input.nearestClusterDistanceKm <= 6
  ) {
    return {
      title: 'מתחבר למסלול קיים',
      hint: `קרוב ל-${input.sameWindowStopCount} אספקות שכבר נקבעו, במרחק כ-${input.nearestClusterDistanceKm.toFixed(1)} ק"מ.`,
    };
  }

  if (input.remainingCapacityMinutes >= 120) {
    return {
      title: 'שומר מרווח תפעולי',
      hint: `משאיר בערך ${input.remainingCapacityMinutes} דקות מרווח ביום לעיכובים ותוספות.`,
    };
  }

  if (input.dayOffset <= 1) {
    return {
      title: 'המועד הקרוב היעיל',
      hint: input.sameDayStopCount
        ? `נכנס למסלול קיים בלי לחרוג מהקיבולת היומית.`
        : 'יום קל יחסית שיכול לקלוט את ההתקנה בלי להעמיס על המסלול.',
    };
  }

  return {
    title: 'חלון מאוזן',
    hint: input.sameDayStopCount
      ? `מנצל יום עם ${input.sameDayStopCount} אספקות קיימות ועדיין שומר על מסלול ישים.`
      : 'נותן למסלול הבא להתחיל ריק ומסודר במקום לדחוס את היום הנוכחי.',
  };
}

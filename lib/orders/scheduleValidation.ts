import { parseTimeStringToMinutes } from '@/lib/store-business-hours';
import { FulfillmentType, ScheduleMode } from '@prisma/client';
import { z } from 'zod';

export const schedulePayloadSchema = z
  .object({
    scheduledAt: z.string().datetime(),
    scheduledEnd: z.string().datetime().nullable().optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    fulfillmentType: z.nativeEnum(FulfillmentType).optional(),
    scheduleMode: z.nativeEnum(ScheduleMode).optional(),
    timeWindowStart: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format HH:mm')
      .optional(),
    timeWindowEnd: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format HH:mm')
      .optional(),
    notesToCrew: z.string().max(500).nullable().optional(),
    status: z.string().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    installerId: z.string().uuid().nullable().optional(),
    installerName: z.string().trim().min(2).max(120).nullable().optional(),
    installerNotes: z.string().trim().max(500).nullable().optional(),
    address: z
      .object({
        city: z.string().min(1, 'עיר נדרשת'),
        street: z.string().min(1, 'רחוב נדרש'),
        number: z.string().min(1, 'מספר בית נדרש'),
        floor: z.string().optional(),
        notes: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .optional(),
    calendarSync: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduleMode === ScheduleMode.TIME_WINDOW) {
        return !!data.timeWindowStart && !!data.timeWindowEnd;
      }
      return true;
    },
    {
      message: 'Time window start and end are required for TIME_WINDOW mode',
      path: ['timeWindowStart'],
    }
  )
  .refine(
    (data) => {
      if (
        data.scheduleMode === ScheduleMode.TIME_WINDOW &&
        data.timeWindowStart &&
        data.timeWindowEnd
      ) {
        return (
          parseTimeStringToMinutes(data.timeWindowEnd) >
          parseTimeStringToMinutes(data.timeWindowStart)
        );
      }
      return true;
    },
    {
      message: 'Time window end must be after start',
      path: ['timeWindowEnd'],
    }
  );

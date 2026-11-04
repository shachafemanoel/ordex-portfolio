import { getFeatureEnv } from '@/lib/envConfig';
import { google } from 'googleapis';

// Service health state
let isCalendarServiceHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 300000; // 5 minutes

// Initialize Google Calendar client with error handling
let auth: any = null;
let calendar: any = null;

function initializeCalendarClient() {
  try {
    const calendarEnv = getFeatureEnv('googleCalendar');

    if (!calendarEnv) {
      console.warn(
        'Google Calendar credentials not configured. Calendar features will be disabled.'
      );
      return false;
    }

    // Support both GCAL_* and GOOGLE_* variable formats
    const serviceAccountEmail =
      calendarEnv.GCAL_SERVICE_ACCOUNT_EMAIL || calendarEnv.GOOGLE_CLIENT_EMAIL;
    const privateKey = calendarEnv.GCAL_SERVICE_ACCOUNT_KEY_BASE64
      ? Buffer.from(calendarEnv.GCAL_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      : calendarEnv.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const calendarId = calendarEnv.GCAL_CALENDAR_ID || calendarEnv.GOOGLE_CALENDAR_ID;

    if (!serviceAccountEmail || !privateKey || !calendarId) {
      console.warn('Google Calendar credentials incomplete. Calendar features will be disabled.');
      return false;
    }

    auth = new google.auth.JWT(serviceAccountEmail, undefined, privateKey, [
      'https://www.googleapis.com/auth/calendar',
    ]);

    calendar = google.calendar({ version: 'v3', auth });
    return true;
  } catch (error) {
    console.error('Failed to initialize Google Calendar client:', error);
    isCalendarServiceHealthy = false;
    return false;
  }
}

// Health check for Google Calendar service
export async function checkCalendarHealth(): Promise<{
  healthy: boolean;
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();

  try {
    if (!calendar && !initializeCalendarClient()) {
      return {
        healthy: false,
        error: 'Calendar service not configured',
        responseTime: Date.now() - startTime,
      };
    }

    const calendarEnv = getFeatureEnv('googleCalendar');
    const calendarId = calendarEnv?.GCAL_CALENDAR_ID || calendarEnv?.GOOGLE_CALENDAR_ID;

    // Test calendar access with a simple query
    await calendar.calendars.get({ calendarId });

    isCalendarServiceHealthy = true;
    lastHealthCheck = Date.now();
    return { healthy: true, responseTime: Date.now() - startTime };
  } catch (error) {
    isCalendarServiceHealthy = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown calendar error';
    console.error('Calendar health check failed:', errorMessage);
    return { healthy: false, error: errorMessage, responseTime: Date.now() - startTime };
  }
}

export async function createEvent(
  summary: string,
  description: string,
  start: Date,
  end: Date,
  location: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendarEnv = getFeatureEnv('googleCalendar');
    const calendarId = calendarEnv?.GCAL_CALENDAR_ID || calendarEnv?.GOOGLE_CALENDAR_ID;

    // Check if calendar service is configured
    if (!calendarId) {
      console.warn('Google Calendar not configured, skipping event creation');
      return { success: false, error: 'Calendar service not configured' };
    }

    // Initialize client if needed
    if (!calendar && !initializeCalendarClient()) {
      return { success: false, error: 'Failed to initialize calendar client' };
    }

    // Check service health if enough time has passed
    if (Date.now() - lastHealthCheck > HEALTH_CHECK_INTERVAL) {
      const healthCheck = await checkCalendarHealth();
      if (!healthCheck.healthy) {
        return { success: false, error: healthCheck.error };
      }
    }

    // Skip if service is known to be unhealthy
    if (!isCalendarServiceHealthy) {
      console.warn('Calendar service is unhealthy, skipping event creation');
      return { success: false, error: 'Calendar service is currently unavailable' };
    }

    // Attempt to create the event with retry logic
    const result = await createEventWithRetry(summary, description, start, end, location);
    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error creating calendar event';
    console.error('Calendar event creation failed:', errorMessage);

    // Mark service as unhealthy on persistent failures
    isCalendarServiceHealthy = false;

    return { success: false, error: errorMessage };
  }
}

async function createEventWithRetry(
  summary: string,
  description: string,
  start: Date,
  end: Date,
  location: string,
  retries = 3
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const calendarEnv = getFeatureEnv('googleCalendar');
      const calendarId = calendarEnv?.GCAL_CALENDAR_ID || calendarEnv?.GOOGLE_CALENDAR_ID;

      const response = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          location,
        },
      });

      console.log(`Calendar event created successfully: ${response.data.id}`);
      isCalendarServiceHealthy = true;
      return { success: true, eventId: response.data.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Calendar event creation attempt ${attempt} failed: ${errorMessage}`);

      // Check if it's a rate limit error and wait before retry
      if (errorMessage.includes('rate') || errorMessage.includes('quota')) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      // Don't retry on auth errors
      if (errorMessage.includes('auth') || errorMessage.includes('permission')) {
        isCalendarServiceHealthy = false;
        return { success: false, error: errorMessage };
      }

      // Last attempt failed
      if (attempt === retries) {
        isCalendarServiceHealthy = false;
        return { success: false, error: errorMessage };
      }
    }
  }

  return { success: false, error: 'All retry attempts failed' };
}

// High-level wrappers aligned with acceptance criteria
export async function createInstallationEvent(order: {
  id: string;
  number: number | string;
  customerName: string;
  note?: string | null;
  address: string;
  city?: string | null;
  installAt: Date;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const title = `${order.customerName} #${order.number}`;
  const description = [order.note || '', order.city || ''].filter(Boolean).join('\n');
  const start = order.installAt;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const location = `${order.address}${order.city ? ', ' + order.city : ''}`;
  return createEvent(title, description, start, end, location);
}

export interface BatchInstallationOrderInfo {
  id: string;
  number: string;
  customerName: string;
  addressLine?: string | null;
  city?: string | null;
  phone?: string | null;
  note?: string | null;
}

export async function createBatchInstallationEvent(params: {
  orders: BatchInstallationOrderInfo[];
  start: Date;
  end: Date;
  locationOverride?: string;
  notes?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!params.orders.length) {
    return { success: false, error: 'No orders provided for installation event' };
  }

  const uniqueCities = Array.from(
    new Set(
      params.orders
        .map((order) => order.city?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const summaryCityPart =
    uniqueCities.length === 1 ? uniqueCities[0] : uniqueCities.length > 1 ? 'מספר ערים' : '';
  const summarySuffix = summaryCityPart ? ` - ${summaryCityPart}` : '';
  const summary = `תיאום התקנה (${params.orders.length})${summarySuffix}`;

  const descriptionParts: string[] = [];
  if (params.notes) {
    descriptionParts.push(params.notes.trim());
  }

  params.orders.forEach((order) => {
    const details = [
      `הזמנה #${order.number}`,
      order.customerName,
      order.city,
      order.addressLine,
      order.phone ? `טלפון: ${order.phone}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    descriptionParts.push(details);
    if (order.note) {
      descriptionParts.push(`הערות: ${order.note}`);
    }
  });

  const description = descriptionParts.join('\n');

  let location = params.locationOverride?.trim();

  if (!location) {
    if (params.orders.length === 1) {
      const order = params.orders[0];
      location = [order.addressLine, order.city].filter(Boolean).join(', ');
    } else if (uniqueCities.length === 1) {
      location = uniqueCities[0];
    } else {
      location = 'מיקומים מרובים';
    }
  }

  return createEvent(summary, description, params.start, params.end, location);
}

export async function updateEventById(
  eventId: string,
  update: {
    summary?: string;
    description?: string;
    start?: Date;
    end?: Date;
    location?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendarEnv = getFeatureEnv('googleCalendar');
    const calendarId = calendarEnv?.GCAL_CALENDAR_ID || calendarEnv?.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      return { success: false, error: 'Calendar service not configured' };
    }
    if (!calendar && !initializeCalendarClient()) {
      return { success: false, error: 'Failed to initialize calendar client' };
    }
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: update.summary,
        description: update.description,
        start: update.start ? { dateTime: update.start.toISOString() } : undefined,
        end: update.end ? { dateTime: update.end.toISOString() } : undefined,
        location: update.location,
      },
    });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Calendar update failed:', msg);
    return { success: false, error: msg };
  }
}

export async function deleteEventById(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendarEnv = getFeatureEnv('googleCalendar');
    const calendarId = calendarEnv?.GCAL_CALENDAR_ID || calendarEnv?.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      return { success: false, error: 'Calendar service not configured' };
    }
    if (!calendar && !initializeCalendarClient()) {
      return { success: false, error: 'Failed to initialize calendar client' };
    }
    await calendar.events.delete({ calendarId, eventId });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Calendar delete failed:', msg);
    return { success: false, error: msg };
  }
}

// Working hours configuration
const WORKING_HOURS = {
  start: 9, // 9 AM
  end: 17, // 5 PM
  weekdays: [1, 2, 3, 4, 5], // Monday to Friday
};

const INSTALLATION_BUFFER_MINUTES = 30; // Buffer time between installations

// Check if a given time slot is within working hours
function isWithinWorkingHours(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = date.getHours();

  return (
    WORKING_HOURS.weekdays.includes(dayOfWeek) &&
    hour >= WORKING_HOURS.start &&
    hour < WORKING_HOURS.end
  );
}

// Get technician availability for a given time period
export async function checkTechnicianAvailability(
  technicianId: string,
  startTime: Date,
  endTime: Date,
  excludeEventId?: string
): Promise<{ available: boolean; conflictingEvents?: any[] }> {
  try {
    // First check if the time is within working hours
    if (!isWithinWorkingHours(startTime) || !isWithinWorkingHours(endTime)) {
      return {
        available: false,
        conflictingEvents: [],
      };
    }

    // Check database for existing calendar events for this technician
    const { prisma } = await import('@/lib/prisma');

    const whereClause: any = {
      assignedTo: technicianId,
      status: { in: ['SCHEDULED'] },
      OR: [
        {
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      ],
    };

    // Exclude a specific event (useful for updates)
    if (excludeEventId) {
      whereClause.id = { not: excludeEventId };
    }

    const conflictingEvents = await prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        order: {
          select: {
            number: true,
            customerName: true,
          },
        },
      },
    });

    // Add buffer time check
    const bufferConflicts = conflictingEvents.filter((event: any) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const bufferStart = new Date(eventStart.getTime() - INSTALLATION_BUFFER_MINUTES * 60 * 1000);
      const bufferEnd = new Date(eventEnd.getTime() + INSTALLATION_BUFFER_MINUTES * 60 * 1000);

      return startTime < bufferEnd && endTime > bufferStart;
    });

    return {
      available: bufferConflicts.length === 0,
      conflictingEvents: bufferConflicts,
    };
  } catch (error) {
    console.error('Error checking technician availability:', error);
    return { available: false };
  }
}

// Get available time slots for a specific date and technician
export async function getAvailableTimeSlots(
  technicianId: string,
  date: Date,
  installationDurationHours: number = 2
): Promise<{ slots: Array<{ start: Date; end: Date }> }> {
  try {
    const dayStart = new Date(date);
    dayStart.setHours(WORKING_HOURS.start, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(WORKING_HOURS.end, 0, 0, 0);

    // Check if it's a working day
    if (!WORKING_HOURS.weekdays.includes(dayStart.getDay())) {
      return { slots: [] };
    }

    const slots: Array<{ start: Date; end: Date }> = [];
    const slotDuration = installationDurationHours * 60; // in minutes
    // const totalBufferTime = INSTALLATION_BUFFER_MINUTES * 2; // Reserved for buffer calculation

    // Generate potential time slots (every 30 minutes)
    for (let time = new Date(dayStart); time < dayEnd; time.setMinutes(time.getMinutes() + 30)) {
      const slotStart = new Date(time);
      const slotEnd = new Date(time.getTime() + slotDuration * 60 * 1000);

      // Skip if slot extends beyond working hours
      if (slotEnd > dayEnd) continue;

      // Check if this slot is available
      const availability = await checkTechnicianAvailability(technicianId, slotStart, slotEnd);
      if (availability.available) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }

    return { slots };
  } catch (error) {
    console.error('Error getting available time slots:', error);
    return { slots: [] };
  }
}

// Create recurring maintenance events
export async function createRecurringMaintenanceEvent(
  orderId: string,
  technicianId: string,
  firstOccurrence: Date,
  recurrenceRule: string, // e.g., "FREQ=MONTHLY;INTERVAL=6"
  durationHours: number = 1
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendarEnv = getFeatureEnv('googleCalendar');
    const calendarId = calendarEnv?.GCAL_CALENDAR_ID || calendarEnv?.GOOGLE_CALENDAR_ID;
    const serviceAccountEmail =
      calendarEnv?.GCAL_SERVICE_ACCOUNT_EMAIL || calendarEnv?.GOOGLE_CLIENT_EMAIL;

    if (!calendarId) {
      return { success: false, error: 'Calendar service not configured' };
    }
    if (!calendar && !initializeCalendarClient()) {
      return { success: false, error: 'Failed to initialize calendar client' };
    }

    // Get order details
    const { prisma } = await import('@/lib/prisma');
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        number: true,
        customerName: true,
        addressLine: true,
        city: true,
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const endTime = new Date(firstOccurrence.getTime() + durationHours * 60 * 60 * 1000);

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `Maintenance - ${order.customerName} #${order.number}`,
        description: `Scheduled maintenance for installation`,
        start: { dateTime: firstOccurrence.toISOString() },
        end: { dateTime: endTime.toISOString() },
        location: `${order.addressLine}${order.city ? ', ' + order.city : ''}`,
        recurrence: [recurrenceRule],
        attendees: serviceAccountEmail
          ? [
              {
                email: serviceAccountEmail,
                displayName: 'Technician',
              },
            ]
          : undefined,
      },
    });

    // Save to database as well
    await prisma.calendarEvent.create({
      data: {
        googleId: response.data.id,
        title: `Maintenance - ${order.customerName} #${order.number}`,
        description: `Scheduled maintenance for installation`,
        startTime: firstOccurrence,
        endTime,
        status: 'SCHEDULED',
        orderId,
        createdBy: technicianId,
      },
    });

    return { success: true, eventId: response.data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating recurring maintenance event:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Batch create multiple installation appointments
export async function batchCreateInstallations(
  installations: Array<{
    orderId: string;
    technicianId: string;
    startTime: Date;
    durationHours?: number;
  }>
): Promise<{
  success: boolean;
  results: Array<{ orderId: string; success: boolean; eventId?: string; error?: string }>;
}> {
  const results = [];

  for (const installation of installations) {
    const { orderId, technicianId, startTime, durationHours = 2 } = installation;

    try {
      // Get order details
      const { prisma } = await import('@/lib/prisma');
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          number: true,
          customerName: true,
          addressLine: true,
          city: true,
          notes: true,
        },
      });

      if (!order) {
        results.push({
          orderId,
          success: false,
          error: 'Order not found',
        });
        continue;
      }

      const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

      // Check availability first
      const availability = await checkTechnicianAvailability(technicianId, startTime, endTime);
      if (!availability.available) {
        results.push({
          orderId,
          success: false,
          error: 'Time slot not available',
        });
        continue;
      }

      // Create the installation event
      const eventResult = await createInstallationEvent({
        id: orderId,
        number: order.number,
        customerName: order.customerName ?? '',
        note: order.notes,
        address: order.addressLine || '',
        city: order.city,
        installAt: startTime,
      });

      if (eventResult.success) {
        // Update order status to INSTALL_SCHEDULING
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'INSTALL_SCHEDULING',
            scheduledAt: startTime,
          },
        });

        // Create calendar event in database
        await prisma.calendarEvent.create({
          data: {
            googleId: eventResult.eventId || null,
            title: `${order.customerName} #${order.number}`,
            description: order.notes || '',
            startTime,
            endTime,
            status: 'SCHEDULED',
            orderId,
            createdBy: technicianId,
          },
        });
      }

      results.push({
        orderId,
        success: eventResult.success,
        eventId: eventResult.eventId,
        error: eventResult.error,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        orderId,
        success: false,
        error: errorMessage,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    success: successCount === installations.length,
    results,
  };
}

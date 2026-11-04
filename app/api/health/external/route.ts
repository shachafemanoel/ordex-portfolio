// Use Web Response to avoid build-time NextResponse issues
import { checkCalendarHealth } from '@/lib/calendar';
import { getFeatureEnv } from '@/lib/env';
import { checkMapboxHealth } from '@/lib/geocode';
import { hasMapboxAccessToken } from '@/lib/mapbox/server';
import { checkTwilioHealth } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Always return 200 OK for Railway health checks
  // External service failures should not block deployments
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ordex-oms-external-services',
    checks: {
      calendar: {
        configured: false,
        status: 'unknown' as 'unknown' | 'healthy' | 'degraded' | 'disabled',
        error: undefined as string | undefined,
      },
      messaging: {
        configured: false,
        status: 'unknown' as 'unknown' | 'healthy' | 'degraded' | 'disabled',
        error: undefined as string | undefined,
      },
      geocoding: {
        configured: false,
        status: 'unknown' as 'unknown' | 'healthy' | 'degraded' | 'disabled',
        error: undefined as string | undefined,
      },
    },
    summary: {
      total: 0,
      healthy: 0,
      degraded: 0,
      disabled: 0,
    },
  };

  // Google Calendar check
  const googleCalendarEnv = getFeatureEnv('googleCalendar');
  if (googleCalendarEnv) {
    health.checks.calendar.configured = true;
    health.summary.total++;

    try {
      // Use timeout to prevent hanging during deployment
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Calendar check timeout')), 5000);
      });

      const calendarResult = await Promise.race([
        checkCalendarHealth(),
        timeoutPromise
      ]) as any;

      health.checks.calendar = {
        ...health.checks.calendar,
        ...calendarResult,
        status: calendarResult.healthy ? 'healthy' : 'degraded',
      };

      if (calendarResult.healthy) {
        health.summary.healthy++;
      } else {
        health.summary.degraded++;
        // Don't mark overall status as degraded for external service issues
        // health.status = 'degraded';
      }
    } catch (error) {
      health.checks.calendar = {
        ...health.checks.calendar,
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Calendar check failed',
      };
      health.summary.degraded++;
      // Don't mark overall status as degraded for external service issues
      // health.status = 'degraded';
    }
  } else {
    health.checks.calendar.status = 'disabled';
    health.summary.disabled++;
  }

  // Twilio messaging check
  const twilioEnv = getFeatureEnv('twilio');
  if (twilioEnv) {
    health.checks.messaging.configured = true;
    health.summary.total++;

    try {
      // Use timeout to prevent hanging during deployment
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Twilio check timeout')), 5000);
      });

      const twilioResult = await Promise.race([
        checkTwilioHealth(),
        timeoutPromise
      ]) as any;

      health.checks.messaging = {
        ...health.checks.messaging,
        ...twilioResult,
        status: twilioResult.healthy ? 'healthy' : 'degraded',
      };

      if (twilioResult.healthy) {
        health.summary.healthy++;
      } else {
        health.summary.degraded++;
        // Don't mark overall status as degraded for external service issues
        // health.status = 'degraded';
      }
    } catch (error) {
      health.checks.messaging = {
        ...health.checks.messaging,
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Messaging check failed',
      };
      health.summary.degraded++;
      // Don't mark overall status as degraded for external service issues
      // health.status = 'degraded';
    }
  } else {
    health.checks.messaging.status = 'disabled';
    health.summary.disabled++;
  }

  // Mapbox geocoding check
  if (hasMapboxAccessToken()) {
    health.checks.geocoding.configured = true;
    health.summary.total++;

    try {
      // Use timeout to prevent hanging during deployment
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Mapbox check timeout')), 5000);
      });

      const mapsResult = await Promise.race([
        checkMapboxHealth(),
        timeoutPromise
      ]) as any;

      health.checks.geocoding = {
        ...health.checks.geocoding,
        ...mapsResult,
        status: mapsResult.healthy ? 'healthy' : 'degraded',
      };

      if (mapsResult.healthy) {
        health.summary.healthy++;
      } else {
        health.summary.degraded++;
        // Don't mark overall status as degraded for external service issues
        // health.status = 'degraded';
      }
    } catch (error) {
      health.checks.geocoding = {
        ...health.checks.geocoding,
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Geocoding check failed',
      };
      health.summary.degraded++;
      // Don't mark overall status as degraded for external service issues
      // health.status = 'degraded';
    }
  } else {
    health.checks.geocoding.status = 'disabled';
    health.summary.disabled++;
  }

  // Add overall metrics
  const totalResponseTime = Date.now() - startTime;
  const healthPercentage =
    health.summary.total > 0
      ? Math.round((health.summary.healthy / health.summary.total) * 100)
      : 100;

  // External service failures shouldn't affect deployment health
  // Keep status as 'healthy' even if external services are degraded
  // The application can function without these external integrations
  if (health.status !== 'healthy' && health.summary.healthy === 0 && health.summary.total > 0) {
    health.status = 'degraded-external-only';
  } else if (health.summary.healthy > 0 || health.summary.total === 0) {
    health.status = 'healthy';
  }

  return Response.json({
    ...health,
    totalResponseTime,
    healthPercentage,
    recommendations: generateRecommendations(health),
    note: 'External service failures do not affect core application functionality',
  });
}

function generateRecommendations(health: any): string[] {
  const recommendations: string[] = [];

  if (health.summary.disabled > 0) {
    recommendations.push(
      'Some external services are not configured. Consider setting up missing integrations for full functionality.'
    );
  }

  if (health.summary.degraded > 0) {
    recommendations.push(
      'Some external services are experiencing issues. Check service credentials and network connectivity.'
    );
  }

  if (health.checks.calendar.configured && health.checks.calendar.status === 'degraded') {
    recommendations.push(
      'Google Calendar integration is failing. Verify GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID environment variables.'
    );
  }

  if (health.checks.messaging.configured && health.checks.messaging.status === 'degraded') {
    recommendations.push(
      'Twilio messaging is failing. Verify TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables.'
    );
  }

  if (health.checks.geocoding.configured && health.checks.geocoding.status === 'degraded') {
    recommendations.push(
      'Mapbox geocoding is failing. Verify MAPBOX or NEXT_PUBLIC_MAPBOX_TOKEN environment variable.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('All configured external services are functioning normally.');
  }

  return recommendations;
}

import twilio from 'twilio';
import { getFeatureEnv } from '@/lib/env';

// Service health state
let isTwilioServiceHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 300000; // 5 minutes
const SMS_RETRY_ATTEMPTS = 3;
const SMS_RETRY_DELAY = 2000; // 2 seconds

// Initialize Twilio client with error handling
let client: any = null;

function initializeTwilioClient() {
  const twilioConfig = getFeatureEnv('twilio');
  try {
    if (
      !twilioConfig?.TWILIO_ACCOUNT_SID ||
      !twilioConfig?.TWILIO_AUTH_TOKEN ||
      !twilioConfig?.TWILIO_FROM_NUMBER
    ) {
      console.warn('Twilio credentials not configured. SMS features will be disabled.');
      return false;
    }

    client = twilio(twilioConfig.TWILIO_ACCOUNT_SID, twilioConfig.TWILIO_AUTH_TOKEN);
    return true;
  } catch (error) {
    console.error('Failed to initialize Twilio client:', error);
    isTwilioServiceHealthy = false;
    return false;
  }
}

// Health check for Twilio service
export async function checkTwilioHealth(): Promise<{
  healthy: boolean;
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();

  try {
    if (!client && !initializeTwilioClient()) {
      return {
        healthy: false,
        error: 'Twilio service not configured',
        responseTime: Date.now() - startTime,
      };
    }

    // Test Twilio connection by fetching account info
    const twilioConfig = getFeatureEnv('twilio');
    if (twilioConfig?.TWILIO_ACCOUNT_SID) {
      await client.api.accounts(twilioConfig.TWILIO_ACCOUNT_SID).fetch();
    } else {
      throw new Error('Twilio Account SID missing');
    }

    isTwilioServiceHealthy = true;
    lastHealthCheck = Date.now();
    return { healthy: true, responseTime: Date.now() - startTime };
  } catch (error) {
    isTwilioServiceHealthy = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown Twilio error';
    console.error('Twilio health check failed:', errorMessage);
    return { healthy: false, error: errorMessage, responseTime: Date.now() - startTime };
  }
}

// Enhanced SMS sending with retry logic and error handling
export async function sendSms(
  to: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Validate phone number format
    if (!to || !isValidPhoneNumber(to)) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // Check if Twilio service is configured
    const twilioConfig = getFeatureEnv('twilio');
    if (!twilioConfig?.TWILIO_FROM_NUMBER) {
      console.warn('Twilio not configured, skipping SMS send');
      return { success: false, error: 'SMS service not configured' };
    }

    // Initialize client if needed
    if (!client && !initializeTwilioClient()) {
      return { success: false, error: 'Failed to initialize SMS client' };
    }

    // Check service health if enough time has passed
    if (Date.now() - lastHealthCheck > HEALTH_CHECK_INTERVAL) {
      const healthCheck = await checkTwilioHealth();
      if (!healthCheck.healthy) {
        return { success: false, error: healthCheck.error };
      }
    }

    // Skip if service is known to be unhealthy
    if (!isTwilioServiceHealthy) {
      console.warn('Twilio service is unhealthy, skipping SMS send');
      return { success: false, error: 'SMS service is currently unavailable' };
    }

    // Attempt to send SMS with retry logic
    const result = await sendSmsWithRetry(to, body);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error sending SMS';
    console.error('SMS sending failed:', errorMessage);

    // Mark service as unhealthy on persistent failures
    isTwilioServiceHealthy = false;

    return { success: false, error: errorMessage };
  }
}

async function sendSmsWithRetry(
  to: string,
  body: string,
  retries = SMS_RETRY_ATTEMPTS
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const twilioConfig = getFeatureEnv('twilio');
  const fromNumber = twilioConfig?.TWILIO_FROM_NUMBER;

  if (!fromNumber) {
    return { success: false, error: 'Twilio From Number missing' };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        to,
        from: fromNumber,
        body,
      });

      console.log(`SMS sent successfully: ${message.sid}`);
      isTwilioServiceHealthy = true;
      return { success: true, messageId: message.sid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`SMS send attempt ${attempt} failed: ${errorMessage}`);

      // Check if it's a rate limit error and wait before retry
      if (
        errorMessage.includes('rate') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('429')
      ) {
        if (attempt < retries) {
          const delay = SMS_RETRY_DELAY * attempt; // Linear backoff for SMS
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      // Don't retry on auth or invalid number errors
      if (
        errorMessage.includes('auth') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('21211')
      ) {
        isTwilioServiceHealthy = false;
        return { success: false, error: errorMessage };
      }

      // Last attempt failed
      if (attempt === retries) {
        isTwilioServiceHealthy = false;
        return { success: false, error: errorMessage };
      }
    }
  }

  return { success: false, error: 'All retry attempts failed' };
}

// Phone number validation helper
function isValidPhoneNumber(phone: string): boolean {
  // Basic phone number validation - starts with + and contains only digits, spaces, hyphens
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  const cleanPhone = phone.replace(/[\s-()]/g, '');
  return phoneRegex.test(cleanPhone);
}

// Bulk SMS sending with rate limiting
export async function sendBulkSms(
  messages: { to: string; body: string }[],
  rateLimitMs = 1000
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  for (const message of messages) {
    try {
      const result = await sendSms(message.to, message.body);
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`${message.to}: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`${message.to}: ${errorMessage}`);
    }

    // Rate limiting between messages
    if (rateLimitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
    }
  }

  return results;
}

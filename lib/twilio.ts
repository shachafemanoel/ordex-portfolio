import { MessageStatus, NotificationMethod, NotificationType } from '@prisma/client';
import twilio from 'twilio';
import { sendEmail } from '@/lib/email';
import { getFeatureEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

// Service health state
let isTwilioServiceHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 300000; // 5 minutes
const SMS_RETRY_ATTEMPTS = 3;
const SMS_RETRY_DELAY = 2000; // 2 seconds

// Cache working hours formatter to avoid expensive re-instantiation
const workingHoursFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jerusalem',
  hour: 'numeric',
  hour12: false,
});

// Initialize Twilio client with error handling
let client: any = null;

function initializeTwilioClient() {
  try {
    const twilioEnv = getFeatureEnv('twilio');
    if (!twilioEnv) {
      logger.warn('Twilio credentials not configured. SMS features will be disabled.');
      return false;
    }

    client = twilio(twilioEnv.TWILIO_ACCOUNT_SID, twilioEnv.TWILIO_AUTH_TOKEN);
    return true;
  } catch (error) {
    logger.error('Failed to initialize Twilio client:', error);
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
    const twilioEnv = getFeatureEnv('twilio');
    if (!twilioEnv) {
      throw new Error('Twilio not configured');
    }
    await client.api.accounts(twilioEnv.TWILIO_ACCOUNT_SID).fetch();

    isTwilioServiceHealthy = true;
    lastHealthCheck = Date.now();
    return { healthy: true, responseTime: Date.now() - startTime };
  } catch (error) {
    isTwilioServiceHealthy = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown Twilio error';
    logger.error('Twilio health check failed:', errorMessage);
    return { healthy: false, error: errorMessage, responseTime: Date.now() - startTime };
  }
}

// Message interface for unified messaging
export interface MessageOptions {
  to: string;
  content: string;
  method: NotificationMethod;
  type?: NotificationType;
  templateVariables?: Record<string, any>;
  subject?: string;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  status: MessageStatus;
  error?: string;
  cost?: number;
}

// Enhanced SMS sending with retry logic and error handling
export async function sendSMS(to: string, content: string): Promise<MessageResult> {
  try {
    // Validate phone number format
    if (!to || !isValidPhoneNumber(to)) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'Invalid phone number format',
      };
    }

    // Check if Twilio service is configured
    const twilioEnv = getFeatureEnv('twilio');
    if (!twilioEnv) {
      logger.warn('Twilio not configured, skipping SMS send');
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'SMS service not configured',
      };
    }

    // Initialize client if needed
    if (!client && !initializeTwilioClient()) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'Failed to initialize SMS client',
      };
    }

    // Check service health if enough time has passed
    if (Date.now() - lastHealthCheck > HEALTH_CHECK_INTERVAL) {
      const healthCheck = await checkTwilioHealth();
      if (!healthCheck.healthy) {
        return {
          success: false,
          status: MessageStatus.FAILED,
          error: healthCheck.error,
        };
      }
    }

    // Skip if service is known to be unhealthy
    if (!isTwilioServiceHealthy) {
      logger.warn('Twilio service is unhealthy, skipping SMS send');
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'SMS service is currently unavailable',
      };
    }

    // Attempt to send SMS with retry logic
    const result = await sendSMSWithRetry(to, content);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error sending SMS';
    logger.error('SMS sending failed:', errorMessage);

    // Mark service as unhealthy on persistent failures
    isTwilioServiceHealthy = false;

    return {
      success: false,
      status: MessageStatus.FAILED,
      error: errorMessage,
    };
  }
}

async function sendSMSWithRetry(
  to: string,
  content: string,
  retries = SMS_RETRY_ATTEMPTS
): Promise<MessageResult> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        to,
        from: getFeatureEnv('twilio')?.TWILIO_FROM_NUMBER,
        body: content,
      });

      logger.info(`SMS sent successfully: ${message.sid}`);
      isTwilioServiceHealthy = true;

      return {
        success: true,
        messageId: message.sid,
        status: MessageStatus.SENT,
        cost: parseFloat(message.price) * 100 || 0, // Convert to cents
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`SMS send attempt ${attempt} failed: ${errorMessage}`);

      // Check if it's a rate limit error and wait before retry
      if (
        errorMessage.includes('rate') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('429')
      ) {
        if (attempt < retries) {
          const delay = SMS_RETRY_DELAY * attempt; // Linear backoff for SMS
          logger.info(`Waiting ${delay}ms before retry...`);
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
        return {
          success: false,
          status: MessageStatus.FAILED,
          error: errorMessage,
        };
      }

      // Last attempt failed
      if (attempt === retries) {
        isTwilioServiceHealthy = false;
        return {
          success: false,
          status: MessageStatus.FAILED,
          error: errorMessage,
        };
      }
    }
  }

  return {
    success: false,
    status: MessageStatus.FAILED,
    error: 'All retry attempts failed',
  };
}

// WhatsApp messaging via Twilio
export async function sendWhatsApp(to: string, content: string): Promise<MessageResult> {
  try {
    // Validate phone number format
    if (!to || !isValidPhoneNumber(to)) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'Invalid phone number format',
      };
    }

    // Check if WhatsApp is configured
    const whatsappEnv = getFeatureEnv('whatsapp');
    if (!whatsappEnv) {
      logger.warn('Twilio not configured, skipping WhatsApp send');
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'WhatsApp service not configured',
      };
    }

    // Initialize client if needed
    if (!client && !initializeTwilioClient()) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'Failed to initialize WhatsApp client',
      };
    }

    // Format WhatsApp number (must include 'whatsapp:' prefix)
    const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const twilioEnv = getFeatureEnv('twilio');
    const whatsappFrom = `whatsapp:${twilioEnv?.TWILIO_FROM_NUMBER}`;

    const message = await client.messages.create({
      to: whatsappTo,
      from: whatsappFrom,
      body: content,
    });

    logger.info(`WhatsApp message sent successfully: ${message.sid}`);
    isTwilioServiceHealthy = true;

    return {
      success: true,
      messageId: message.sid,
      status: MessageStatus.SENT,
      cost: parseFloat(message.price) * 100 || 0, // Convert to cents
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error sending WhatsApp';
    logger.error('WhatsApp sending failed:', errorMessage);

    return {
      success: false,
      status: MessageStatus.FAILED,
      error: errorMessage,
    };
  }
}

// Unified message sending function
export async function sendMessage(options: MessageOptions): Promise<MessageResult> {
  const { to, content, method, subject } = options;

  // Check working hours for SMS/WhatsApp (Email is 24/7)
  if (method !== NotificationMethod.EMAIL && !(await isWithinWorkingHours(to))) {
    logger.info(`Skipping message to ${to} - outside working hours`);
    return {
      success: false,
      status: MessageStatus.FAILED,
      error: 'Outside working hours',
    };
  }

  switch (method) {
    case NotificationMethod.SMS:
      return await sendSMS(to, content);

    case NotificationMethod.WHATSAPP:
      return await sendWhatsApp(to, content);

    case NotificationMethod.EMAIL: {
      const emailSubject = subject || (options.type ? `Notification: ${options.type}` : 'Notification');
      const emailResult = await sendEmail(to, emailSubject, content);

      return {
        success: emailResult.success,
        status: emailResult.success ? MessageStatus.SENT : MessageStatus.FAILED,
        error: emailResult.error,
        messageId: emailResult.id,
      };
    }

    case NotificationMethod.DISABLED:
      logger.info(`Notifications disabled for ${to}`);
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'Notifications disabled',
      };

    default:
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: 'Unsupported notification method',
      };
  }
}

// Check if current time is within working hours for a phone number
async function isWithinWorkingHours(_phoneNumber: string): Promise<boolean> {
  try {
    // TODO: Get customer preferences from database
    // For now, use default working hours (9 AM - 6 PM Israel time)
    const now = new Date();
    const israelTime = workingHoursFormatter.format(now);

    const currentHour = parseInt(israelTime, 10);

    // Default working hours: 9 AM to 6 PM
    return currentHour >= 9 && currentHour < 18;
  } catch (error) {
    logger.error('Error checking working hours:', error);
    // If we can't determine working hours, allow the message
    return true;
  }
}

// Phone number validation helper
function isValidPhoneNumber(phone: string): boolean {
  // Basic phone number validation - starts with + and contains only digits, spaces, hyphens
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  const cleanPhone = phone.replace(/[\s-()]/g, '');
  return phoneRegex.test(cleanPhone);
}

// Format phone number to E.164 format
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it doesn't start with +, assume it's an Israeli number and add +972
  if (!cleaned.startsWith('+')) {
    // Remove leading 0 if present for Israeli numbers
    const withoutLeadingZero = cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
    return `+972${withoutLeadingZero}`;
  }

  return cleaned;
}

// Bulk message sending with rate limiting
export async function sendBulkMessages(
  messages: MessageOptions[],
  rateLimitMs = 1000
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  for (const messageOptions of messages) {
    try {
      const result = await sendMessage(messageOptions);
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`${messageOptions.to}: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`${messageOptions.to}: ${errorMessage}`);
    }

    // Rate limiting between messages
    if (rateLimitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
    }
  }

  return results;
}

// Get message delivery status from Twilio
export async function getMessageStatus(messageId: string): Promise<{
  status: MessageStatus;
  error?: string;
  deliveredAt?: Date;
}> {
  try {
    if (!client && !initializeTwilioClient()) {
      return { status: MessageStatus.FAILED, error: 'Twilio client not initialized' };
    }

    const message = await client.messages(messageId).fetch();

    // Map Twilio status to our MessageStatus enum
    let status: MessageStatus;
    switch (message.status) {
      case 'queued':
      case 'accepted':
        status = MessageStatus.PENDING;
        break;
      case 'sent':
        status = MessageStatus.SENT;
        break;
      case 'delivered':
      case 'read':
        status = MessageStatus.SENT;
        break;
      case 'failed':
      case 'undelivered':
        status = MessageStatus.FAILED;
        break;
      default:
        status = MessageStatus.PENDING;
    }

    return {
      status,
      deliveredAt: message.dateUpdated ? new Date(message.dateUpdated) : undefined,
      error: message.errorMessage || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to get message status for ${messageId}:`, errorMessage);
    return { status: MessageStatus.FAILED, error: errorMessage };
  }
}

// Template variable replacement
export function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{${key}}`, 'g');
    processed = processed.replace(regex, String(value || ''));
  }

  return processed;
}

// Default message templates
const defaultTemplates = {
  APPOINTMENT_CONFIRMATION: {
    SMS: 'Hi {customerName}, your installation is confirmed for {appointmentDate} at {address}. Our team will arrive between {timeSlot}. Order #{orderNumber}',
    WHATSAPP:
      'Hi {customerName}! 👋\n\nYour installation is confirmed for {appointmentDate} at {address}.\n\nOur team will arrive between {timeSlot}.\n\nOrder #{orderNumber}\n\nReply if you have any questions!',
  },
  APPOINTMENT_REMINDER_1HOUR: {
    SMS: 'Reminder: Your installation starts in 1 hour at {address}. Our team is on the way! Order #{orderNumber}',
    WHATSAPP:
      'Reminder 🔔\n\nYour installation starts in 1 hour at {address}.\n\nOur team is on the way!\n\nOrder #{orderNumber}',
  },
  APPOINTMENT_REMINDER_1DAY: {
    SMS: 'Reminder: Your installation is scheduled for tomorrow at {appointmentDate}, {address}. Order #{orderNumber}',
    WHATSAPP:
      "Reminder 📅\n\nYour installation is scheduled for tomorrow at {appointmentDate}.\n\nLocation: {address}\n\nOrder #{orderNumber}\n\nWe'll send another reminder closer to the time.",
  },
  APPOINTMENT_REMINDER_1WEEK: {
    SMS: "Your installation is scheduled for {appointmentDate} at {address}. Order #{orderNumber}. We'll send reminders closer to the date.",
    WHATSAPP:
      "Installation Scheduled 📋\n\nYour installation is scheduled for {appointmentDate} at {address}.\n\nOrder #{orderNumber}\n\nWe'll send reminders closer to the date.",
  },
  APPOINTMENT_DELAY: {
    SMS: "Hi {customerName}, we need to reschedule your installation originally planned for {originalDate}. We'll contact you soon with new options. Order #{orderNumber}",
    WHATSAPP:
      "Hi {customerName},\n\nWe need to reschedule your installation originally planned for {originalDate}.\n\nWe'll contact you soon with new options.\n\nOrder #{orderNumber}\n\nSorry for any inconvenience!",
  },
  INSTALLATION_COMPLETE: {
    SMS: 'Installation complete! Thank you for choosing us. Please rate your experience: [link]. Order #{orderNumber}',
    WHATSAPP:
      "Installation Complete! ✅\n\nThank you for choosing us, {customerName}!\n\nWe hope you're happy with the results.\n\nOrder #{orderNumber}\n\nPlease rate your experience: [link]",
  },
} satisfies Partial<Record<NotificationType, Partial<Record<NotificationMethod, string>>>>;

export const DEFAULT_TEMPLATES = defaultTemplates;

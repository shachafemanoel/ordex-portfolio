
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { sendMessage } from '@/lib/twilio';
import { NotificationMethod } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/env', () => ({
  env: {
    TWILIO_ACCOUNT_SID: 'mock_sid',
    TWILIO_AUTH_TOKEN: 'mock_token',
    TWILIO_FROM_NUMBER: 'mock_number',
  },
  getFeatureEnv: (feature: string) =>
    feature === 'twilio'
      ? {
          TWILIO_ACCOUNT_SID: 'mock_sid',
          TWILIO_AUTH_TOKEN: 'mock_token',
          TWILIO_FROM_NUMBER: 'mock_number',
        }
      : null,
  requireFeatureEnv: (feature: string) =>
    feature === 'twilio'
      ? {
          TWILIO_ACCOUNT_SID: 'mock_sid',
          TWILIO_AUTH_TOKEN: 'mock_token',
          TWILIO_FROM_NUMBER: 'mock_number',
        }
      : (() => {
          throw new Error('missing feature');
        })(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock twilio client
const mockMessagesCreate = vi.fn().mockResolvedValue({
  sid: 'SM123',
  price: '0.01',
});

vi.mock('twilio', () => {
  return {
    default: () => ({
      messages: {
        create: mockMessagesCreate,
      },
      api: {
        accounts: () => ({
          fetch: vi.fn().mockResolvedValue({}),
        }),
      },
    }),
  };
});

describe('lib/twilio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isWithinWorkingHours', () => {
    // Note: We can't easily export isWithinWorkingHours directly as it's not exported.
    // We test it via sendMessage.

    it('should send message during working hours (10:00 AM)', async () => {
      // Set time to 10:00 AM Israel time
      // 10:00 AM Israel is 07:00 or 08:00 UTC depending on DST.
      // Easiest is to mock Date.

      // Let's force Date to a specific time that corresponds to 10:00 AM in Asia/Jerusalem
      // UTC: 2024-05-22T07:00:00Z -> Israel (UTC+3): 10:00
      vi.setSystemTime(new Date('2024-05-22T07:00:00Z'));

      await sendMessage({
        to: '+972501234567',
        content: 'Test message',
        method: NotificationMethod.SMS,
      });

      expect(mockMessagesCreate).toHaveBeenCalled();
    });

    it('should skip message outside working hours (20:00 PM)', async () => {
        // Set time to 20:00 PM Israel time
        // UTC: 2024-05-22T17:00:00Z -> Israel (UTC+3): 20:00
        vi.setSystemTime(new Date('2024-05-22T17:00:00Z'));

        const result = await sendMessage({
          to: '+972501234567',
          content: 'Test message',
          method: NotificationMethod.SMS,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Outside working hours');
        expect(mockMessagesCreate).not.toHaveBeenCalled();
      });

      it('should skip message before working hours (05:00 AM)', async () => {
        // Set time to 05:00 AM Israel time
        // UTC: 2024-05-22T02:00:00Z -> Israel (UTC+3): 05:00
        vi.setSystemTime(new Date('2024-05-22T02:00:00Z'));

        const result = await sendMessage({
          to: '+972501234567',
          content: 'Test message',
          method: NotificationMethod.SMS,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Outside working hours');
        expect(mockMessagesCreate).not.toHaveBeenCalled();
      });
  });
});

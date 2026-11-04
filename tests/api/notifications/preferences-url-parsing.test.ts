/**
 * Notification Preferences API - URL Parsing Bug Fix Tests
 *
 * Tests to verify the fix for Bug 1:
 * The outer catch block now uses proper URL parsing instead of string splitting
 * to extract customerPhone from query parameters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/notifications/preferences/route';
import { NextRequest } from 'next/server';

// Mock the Prisma client
const mockFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    customerNotificationPreferences: {
      findUnique: mockFindUnique,
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock formatPhoneNumber
vi.mock('@/lib/twilio', () => ({
  formatPhoneNumber: (phone: string) => phone.replace(/\D/g, ''),
}));

describe('Notification Preferences API - URL Parsing Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug Fix: Proper URL Parsing in Error Handler', () => {
    it('should handle URL-encoded phone numbers correctly', async () => {
      // Simulate URL parsing failure in main try block by making Prisma throw
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      // URL with encoded phone number: +972501234567 → %2B972501234567
      const encodedPhone = encodeURIComponent('+972501234567');
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=${encodedPhone}`
      );

      const response = await GET(request);
      const data = await response.json();

      // Should successfully decode the phone number
      expect(data.success).toBe(true);
      expect(data.data.customerPhone).toBe('972501234567'); // Formatted (stripped +)
      expect(data.isDefault).toBe(true);
    });

    it('should handle multiple query parameters correctly', async () => {
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      // URL with multiple parameters
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=0501234567&other=value&another=test`
      );

      const response = await GET(request);
      const data = await response.json();

      // Should extract only customerPhone, ignoring other params
      expect(data.success).toBe(true);
      expect(data.data.customerPhone).toBe('0501234567');
      expect(data.isDefault).toBe(true);
    });

    it('should handle special characters in phone number', async () => {
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      // Phone with special characters that need encoding
      const phoneWithSpecialChars = '050-123-4567';
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=${encodeURIComponent(phoneWithSpecialChars)}`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.customerPhone).toBe('0501234567'); // Formatted
    });

    it('should return 400 error when customerPhone is missing in error scenario', async () => {
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      // URL without customerPhone parameter
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?other=value`
      );

      const response = await GET(request);
      const data = await response.json();

      // Should return error, not invalid defaults
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('customerPhone parameter required');
    });

    it('should return 400 error when customerPhone is empty string', async () => {
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=`
      );

      const response = await GET(request);
      const data = await response.json();

      // Should return error for empty customerPhone
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should handle malformed URLs gracefully in error handler', async () => {
      // Create a mock request with a malformed URL structure
      // This tests the nested try-catch in the error handler
      const mockRequest = {
        url: 'not-a-valid-url',
      } as NextRequest;

      // Mock URL constructor to throw
      const originalURL = global.URL;
      global.URL = class extends originalURL {
        constructor(url: string) {
          if (url === 'not-a-valid-url') {
            throw new Error('Invalid URL');
          }
          super(url);
        }
      } as any;

      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      const response = await GET(mockRequest);
      const data = await response.json();

      // Should return 400 error when URL parsing fails completely
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);

      // Restore original URL constructor
      global.URL = originalURL;
    });
  });

  describe('Regression: Original Functionality Still Works', () => {
    it('should return preferences when found in database', async () => {
      const mockPreferences = {
        customerPhone: '0501234567',
        preferredMethod: 'WHATSAPP',
        isOptedOut: false,
        workingHoursOnly: true,
        workingHoursStart: 9,
        workingHoursEnd: 18,
        timezone: 'Asia/Jerusalem',
      };

      mockFindUnique.mockResolvedValue(mockPreferences);

      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=0501234567`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockPreferences);
      expect(data.isDefault).toBe(false);
    });

    it('should return default preferences when not found in database', async () => {
      mockFindUnique.mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=0509999999`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.customerPhone).toBe('0509999999');
      expect(data.data.preferredMethod).toBe('SMS');
      expect(data.isDefault).toBe(true);
    });

    it('should return 400 when customerPhone parameter is missing', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('customerPhone parameter is required');
    });
  });

  describe('Edge Cases Previously Broken by String Splitting', () => {
    it('should handle phone number with & character (if URL-encoded)', async () => {
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      // This would break with string splitting: split('customerPhone=')[1] would get '050&test'
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=050123&foo=bar`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.customerPhone).toBe('050123'); // Should extract only the phone
    });

    it('should handle phone number that appears twice in URL', async () => {
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      // With string splitting, this could extract the wrong occurrence
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?note=customerPhone=wrong&customerPhone=0501234567`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.customerPhone).toBe('0501234567'); // Should get the actual parameter value
    });

    it('should handle phone number with = sign (if URL-encoded)', async () => {
      mockFindUnique.mockRejectedValue(new Error('Simulated error'));

      // Phone number: "050=test" (weird but possible)
      const weirdPhone = '050=test';
      const request = new NextRequest(
        `http://localhost:3000/api/notifications/preferences?customerPhone=${encodeURIComponent(weirdPhone)}`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.customerPhone).toBe('050test'); // Formatted (special chars removed)
    });
  });
});

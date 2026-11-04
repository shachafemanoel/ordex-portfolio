import { CalendarItemStatus, CalendarItemType, Priority } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Calendar API Endpoints', () => {
  let authToken: string;
  let testCalendarItemId: string;

  beforeAll(async () => {
    // Login to get auth token
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@ordex.co.il',
        password: 'admin123',
      }),
    });

    const loginData = await loginRes.json();
    authToken = loginData.token;
  });

  afterAll(async () => {
    // Cleanup test calendar item
    if (testCalendarItemId) {
      await fetch(`${API_BASE}/api/calendar/${testCalendarItemId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    }
  });

  describe('POST /api/calendar', () => {
    it('should create a new calendar item', async () => {
      const response = await fetch(`${API_BASE}/api/calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: CalendarItemType.EVENT,
          title: 'API Test Event',
          description: 'Created via API test',
          startTime: new Date('2026-01-20T14:00:00Z').toISOString(),
          endTime: new Date('2026-01-20T15:00:00Z').toISOString(),
          priority: Priority.MEDIUM,
        }),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('API Test Event');

      testCalendarItemId = data.data.id;
    });
  });

  describe('GET /api/calendar', () => {
    it('should get calendar items with filters', async () => {
      const response = await fetch(`${API_BASE}/api/calendar?type=${CalendarItemType.EVENT}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should get month view', async () => {
      const response = await fetch(`${API_BASE}/api/calendar?view=month&date=2026-01`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('GET /api/calendar/:id', () => {
    it('should get calendar item by ID', async () => {
      const response = await fetch(`${API_BASE}/api/calendar/${testCalendarItemId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.id).toBe(testCalendarItemId);
      expect(data.data.title).toBe('API Test Event');
    });
  });

  describe('PUT /api/calendar/:id', () => {
    it('should update calendar item', async () => {
      const response = await fetch(`${API_BASE}/api/calendar/${testCalendarItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Updated API Test Event',
          status: CalendarItemStatus.COMPLETED,
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.title).toBe('Updated API Test Event');
      expect(data.data.status).toBe(CalendarItemStatus.COMPLETED);
    });
  });

  describe('POST /api/calendar/:id/sync', () => {
    it('should enable external sync', async () => {
      const response = await fetch(`${API_BASE}/api/calendar/${testCalendarItemId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          provider: 'GOOGLE',
          enabled: true,
          externalId: 'test-google-event-id',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.success).toBe(true);
      expect(data.data.enabled).toBe(true);
    });
  });
});

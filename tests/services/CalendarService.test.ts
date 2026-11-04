import { getPrismaClient } from '@/lib/db';
import { CalendarService } from '@/lib/services/calendar';
import { CalendarItemStatus, CalendarItemType, Priority } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const prisma = getPrismaClient();
const calendarService = new CalendarService(prisma);

describe('CalendarService', () => {
  let testUserId: string;
  let testOrderId: string;
  let testCalendarItemId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-calendar-${Date.now()}@example.com`,
        name: 'Test Calendar User',
        role: 'SALES',
      },
    });
    testUserId = user.id;

    // Create test order
    const order = await prisma.order.create({
      data: {
        number: `TEST-CAL-${Date.now()}`,
        status: 'TO_DO',
        totalCents: 10000,
        demo: true,
      },
    });
    testOrderId = order.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testCalendarItemId) {
      await prisma.calendarItem.deleteMany({
        where: { id: testCalendarItemId },
      });
    }
    await prisma.order.deleteMany({ where: { id: testOrderId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('CRUD Operations', () => {
    it('should create a calendar item', async () => {
      const item = await calendarService.createCalendarItem(
        {
          type: CalendarItemType.EVENT,
          title: 'Test Event',
          description: 'Test Description',
          startTime: new Date('2026-01-15T10:00:00Z'),
          endTime: new Date('2026-01-15T11:00:00Z'),
          priority: Priority.HIGH,
          assignedToId: testUserId,
          orderId: testOrderId,
        },
        testUserId
      );

      expect(item).toBeDefined();
      expect(item.title).toBe('Test Event');
      expect(item.type).toBe(CalendarItemType.EVENT);
      expect(item.status).toBe(CalendarItemStatus.PENDING);

      testCalendarItemId = item.id;
    });

    it('should get calendar item by ID', async () => {
      const item = await calendarService.getCalendarItemById(testCalendarItemId);

      expect(item).toBeDefined();
      expect(item?.id).toBe(testCalendarItemId);
      expect(item?.title).toBe('Test Event');
    });

    it('should update calendar item', async () => {
      const updated = await calendarService.updateCalendarItem(testCalendarItemId, {
        title: 'Updated Event',
        status: CalendarItemStatus.IN_PROGRESS,
      });

      expect(updated.title).toBe('Updated Event');
      expect(updated.status).toBe(CalendarItemStatus.IN_PROGRESS);
    });

    it('should get calendar items with filters', async () => {
      const items = await calendarService.getCalendarItems({
        type: CalendarItemType.EVENT,
        assignedToId: testUserId,
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].type).toBe(CalendarItemType.EVENT);
    });
  });

  describe('View Methods', () => {
    it('should get day view', async () => {
      const items = await calendarService.getDayView(new Date('2026-01-15'), testUserId);

      expect(Array.isArray(items)).toBe(true);
      // Should include our test event
      const hasTestEvent = items.some((item) => item.id === testCalendarItemId);
      expect(hasTestEvent).toBe(true);
    });

    it('should get week view', async () => {
      const items = await calendarService.getWeekView(new Date('2026-01-12'), testUserId);

      expect(Array.isArray(items)).toBe(true);
    });

    it('should get month view', async () => {
      const items = await calendarService.getMonthView(1, 2026, testUserId);

      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('Task Integration', () => {
    it('should sync task to calendar', async () => {
      // Create a test task
      const task = await prisma.task.create({
        data: {
          type: 'CALL_BACK',
          status: 'OPEN',
          priority: 'HIGH',
          orderId: testOrderId,
          assigneeId: testUserId,
          dueAt: new Date('2026-01-20T15:00:00Z'),
          notes: 'Test task',
        },
      });

      const calendarItem = await calendarService.syncTaskToCalendar(task.id);

      expect(calendarItem).toBeDefined();
      expect(calendarItem.type).toBe(CalendarItemType.TASK);
      expect(calendarItem.taskId).toBe(task.id);
      expect(calendarItem.dueDate).toBeDefined();

      // Cleanup
      await prisma.calendarItem.deleteMany({ where: { taskId: task.id } });
      await prisma.task.deleteMany({ where: { id: task.id } });
    });
  });
});

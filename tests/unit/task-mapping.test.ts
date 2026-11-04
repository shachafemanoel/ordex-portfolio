import { describe, expect, it } from 'vitest';
import { mapTaskToDashboardItem } from '@/lib/services/userDashboardService';

describe('Task Mapping', () => {
  it('should map CALL_BACK to Hebrew label', () => {
    const task = {
      id: '1',
      type: 'CALL_BACK',
      notes: 'Call customer',
      priority: 'HIGH',
      dueAt: new Date(),
    };
    const mapped = mapTaskToDashboardItem(task);
    expect(mapped.title).toBe('חזרה ללקוח');
  });

  it('should map INSTALL_REMINDER to Hebrew label', () => {
    const task = {
      id: '2',
      type: 'INSTALL_REMINDER',
    };
    const mapped = mapTaskToDashboardItem(task);
    expect(mapped.title).toBe('תיאום התקנה');
  });

  it('should fallback to type if no label exists', () => {
    const task = {
      id: '3',
      type: 'NEW_TYPE',
    };
    const mapped = mapTaskToDashboardItem(task);
    expect(mapped.title).toBe('NEW_TYPE');
  });

  it('should fallback to "משימה" if type is missing/falsy (edge case)', () => {
    const task = {
      id: '4',
      type: null,
    };
    const mapped = mapTaskToDashboardItem(task);
    expect(mapped.title).toBe('משימה');
  });
});

import { describe, it, expect } from 'vitest';
import { deriveOrderTask, TriggerInput } from '@/src/server/services/ops-triggers.service';

describe('deriveOrderTask', () => {
  it('should return GRAY when order is on hold', () => {
    const input: Partial<TriggerInput> = {
      status: 'RECEIVED',
      onHold: true,
    };
    const result = deriveOrderTask(input);
    expect(result.taskColor).toBe('GRAY');
    expect(result.taskTitleHe).toBe('בהמתנה');
  });

  it('should return BLUE and "הזמנה חדשה" for a new RECEIVED order', () => {
    const input: Partial<TriggerInput> = {
      status: 'RECEIVED',
      onHold: false,
    };
    const result = deriveOrderTask(input);
    expect(result.taskColor).toBe('BLUE');
    expect(result.taskTitleHe).toBe('הזמנה חדשה');
  });

  it('should return ORANGE and "ממתין לסחורה" when status is AWAITING_STOCK', () => {
    const input: Partial<TriggerInput> = {
      status: 'AWAITING_STOCK',
      onHold: false,
    };
    const result = deriveOrderTask(input);
    expect(result.taskColor).toBe('ORANGE');
    expect(result.taskTitleHe).toBe('ממתין לסחורה');
    expect(result.primaryActionHe).toBe('קליטת סחורה');
  });

  it('should return ORANGE and "רכש בתהליך" when items have open POs', () => {
    const input: Partial<TriggerInput> = {
      status: 'PROCESSING',
      onHold: false,
      items: [
        { allocationStatus: 'ON_ORDER' }
      ],
    };
    const result = deriveOrderTask(input);
    expect(result.taskColor).toBe('ORANGE');
    expect(result.taskTitleHe).toBe('רכש בתהליך');
  });

  it('should return ORANGE and "בהכנה" for partial supply', () => {
    const input: Partial<TriggerInput> = {
      status: 'PROCESSING',
      onHold: false,
      items: [
        { received: true },
        { received: false },
      ],
    };
    const result = deriveOrderTask(input);
    expect(result.taskColor).toBe('ORANGE');
    expect(result.taskTitleHe).toBe('בהכנה');
  });

  it('should return BLUE and "לתיאום התקנה" when ready for installation', () => {
    const input: Partial<TriggerInput> = {
      status: 'READY',
      onHold: false,
      fulfillmentType: 'INSTALLATION',
    };
    const result = deriveOrderTask(input);
    expect(result.taskColor).toBe('BLUE');
    expect(result.taskTitleHe).toBe('לתיאום התקנה');
  });

  it('should return BLUE and "לחזור ללקוח" when status is CALL_BACK', () => {
    const input: Partial<TriggerInput> = {
      status: 'CALL_BACK',
      onHold: false,
    };
    const result = deriveOrderTask(input);
    expect(result.taskColor).toBe('BLUE');
    expect(result.taskTitleHe).toBe('לחזור ללקוח');
  });
});

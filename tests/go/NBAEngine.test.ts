import { describe, it, expect } from 'vitest';
import { NBAEngine } from '@/lib/services/go/NBAEngine';

describe('NBAEngine', () => {
  it('should return LATE action if category is LATE', () => {
    const order = { id: '1', status: 'RECEIVED' };
    const action = NBAEngine.getAction(order, 'EXCEPTION', 'LATE');
    expect(action.label).toBe('עדכן מועד');
    expect(action.variant).toBe('destructive');
  });

  it('should return BLOCKED action if category is BLOCKED', () => {
    const order = { id: '1', status: 'RECEIVED' };
    const action = NBAEngine.getAction(order, 'EXCEPTION', 'BLOCKED');
    expect(action.label).toBe('השלמת פרטים');
    expect(action.variant).toBe('destructive');
  });

  it('should return Approve for RECEIVED', () => {
    const order = { id: '1', status: 'RECEIVED' };
    const action = NBAEngine.getAction(order, 'TODAY');
    expect(action.label).toBe('אשר הזמנה');
    expect(action.variant).toBe('primary');
  });

  it('should return Start for SCHEDULED today', () => {
    const today = new Date();
    const order = { id: '1', status: 'SCHEDULED', scheduledAt: today };
    const action = NBAEngine.getAction(order, 'TODAY');
    expect(action.label).toBe('התחל ביצוע');
    expect(action.variant).toBe('primary');
  });

  it('should return View for SCHEDULED tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const order = { id: '1', status: 'SCHEDULED', scheduledAt: tomorrow };
    const action = NBAEngine.getAction(order, 'TODAY');
    expect(action.label).toBe('צפה בפרטים');
    expect(action.variant).toBe('ghost');
  });

  it('should return Arrive for IN_TRANSIT', () => {
    const order = { id: '1', status: 'IN_TRANSIT' };
    const action = NBAEngine.getAction(order, 'TODAY');
    expect(action.label).toBe('סמן כהגיע');
  });
});

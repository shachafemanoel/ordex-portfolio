import { describe, expect, it } from 'vitest';
import {
  canExecuteAction,
  getActionTransition,
} from '@/lib/orders/ops/workflowStateMachine';

describe('workflowStateMachine', () => {
  it('allows accept-to-production from PROCESSING and maps to AWAITING_STOCK', () => {
    const transition = getActionTransition('accept-to-production');
    expect(transition.to).toBe('AWAITING_STOCK');
    expect(canExecuteAction('PROCESSING', 'accept-to-production')).toBe(true);
  });

  it('blocks goods-accepted from TO_DO', () => {
    expect(canExecuteAction('TO_DO', 'goods-accepted')).toBe(false);
  });

  it('allows mark-ready-delivery from INSTALL_SCHEDULING', () => {
    expect(canExecuteAction('INSTALL_SCHEDULING', 'mark-ready-delivery')).toBe(true);
  });
});

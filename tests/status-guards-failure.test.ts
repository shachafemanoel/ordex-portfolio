import { describe, expect, it, vi } from 'vitest';
import { executeGuards } from '@/lib/status-guards';
import { WORKFLOW_REQUIREMENTS } from '@/lib/workflow-requirements';

describe('required status guard failures', () => {
  it('blocks a transition if a required condition cannot be evaluated', () => {
    const condition = WORKFLOW_REQUIREMENTS.PROCESSING.conditions[0];
    const check = vi.spyOn(condition, 'check').mockImplementation(() => { throw new Error('guard unavailable'); });
    try {
      const result = executeGuards({ items: [{ id: 'item' }] }, 'PROCESSING');
      expect(result.allPassed).toBe(false);
      expect(result.blockingFailures).toContainEqual({ id: condition.name, message: condition.message });
    } finally { check.mockRestore(); }
  });
});

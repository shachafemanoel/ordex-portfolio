import { describe, it, expect } from 'vitest';
import { executeGuards } from '@/lib/status-guards';
import { OrderStatus } from '@prisma/client';

describe('status-guards', () => {
  it('should pass if all manual actions are completed in checklistState', () => {
    const order = {
      id: 'test-order',
      status: 'RECEIVED' as OrderStatus,
      customerName: 'Test Customer',
      customerPhone: '123456789',
      items: [{ id: 'item-1', received: true }],
      checklistState: {
        'manual_PROCESSING_0': true,
        'manual_PROCESSING_1': true,
      },
    };

    const result = executeGuards(order, 'PROCESSING' as OrderStatus);
    
    // This will fail currently because executeGuards looks at order.metadata.checklist
    expect(result.allPassed).toBe(true);
  });

  it('should reject processing when there are no order items', () => {
    const order = {
      id: 'test-order',
      status: 'RECEIVED' as OrderStatus,
      customerName: 'Test Customer',
      customerPhone: '123456789',
      items: [],
      checklistState: {
        'manual_PROCESSING_0': true,
        // Manual task state does not replace the required item guard.
      },
    };

    const result = executeGuards(order, 'PROCESSING' as OrderStatus);
    expect(result.allPassed).toBe(false);
    expect(result.blockingFailures[0].message).toContain('פריטים');
  });
});

import { describe, expect, it } from 'vitest';
import { failureState } from '@/lib/integrations/woocommerce/jobs';
// The old source/webhookEvent models no longer exist. The actual concurrent SQL claims,
// duplicate deliveries and crash recovery are verified by scripts/verify-woo-processing.ts.
describe('worker recovery policy',()=>{
 it('bounds a repeatedly failing recovered job instead of retrying forever',()=>{
  expect(failureState(new Error('temporary'),4).state).toBe('PENDING');
  expect(failureState(new Error('temporary'),5).state).toBe('FAILED');
 });
});

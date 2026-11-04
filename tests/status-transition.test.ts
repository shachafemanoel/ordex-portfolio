import { describe, expect, it } from 'vitest';
import { validateTransition } from '@/lib/status-machine';
// The former SQL test targeted removed legacy columns. Current real-DB departure and
// atomic-history checks live in verify-order-status-flow.ts and verify-payment-departure.ts.
describe('active order transition guard',()=>{
 it.each(['RECEIVED','PROCESSING','READY'] as const)('does not skip from %s to completion',from=>expect(validateTransition(from,'COMPLETED').allowed).toBe(false));
 it('allows receipt to handling and makes completion final',()=>{expect(validateTransition('RECEIVED','PROCESSING').allowed).toBe(true);expect(validateTransition('COMPLETED','RECEIVED').allowed).toBe(false);});
});

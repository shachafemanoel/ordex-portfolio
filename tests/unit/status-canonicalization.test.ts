import { describe, expect, it } from 'vitest';
import { normalizeToCanonicalStatus, getCanonicalStatusLabel } from '@/lib/orderStatus';
describe('active status normalization',()=>{
 it.each(['RECEIVED','PROCESSING','READY','IN_TRANSIT','INSTALLATION','COMPLETED','ON_HOLD','CANCELLED'] as const)('preserves %s',status=>expect(normalizeToCanonicalStatus(status)).toBe(status));
 it('accepts normalized casing without advancing the flow',()=>{expect(normalizeToCanonicalStatus('processing')).toBe('PROCESSING');expect(normalizeToCanonicalStatus('ready')).toBe('READY');});
 it('preserves historical enum values rather than advancing their work',()=>expect(normalizeToCanonicalStatus('PENDING_APPROVAL')).toBe('PENDING_APPROVAL'));
 it('provides Hebrew labels for active operator steps',()=>{expect(getCanonicalStatusLabel('RECEIVED')).toBe('התקבל');expect(getCanonicalStatusLabel('COMPLETED')).toBe('הושלם');});
});

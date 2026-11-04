import { describe, it, expect } from 'vitest';
import { mapLegacyStatus } from '@/lib/services/statusMapping';
describe('status mirrors do not advance the operational flow',()=>{
 it.each(['RECEIVED','PROCESSING','READY','IN_TRANSIT','INSTALLATION','COMPLETED','ON_HOLD','CANCELLED'] as const)('preserves %s',status=>expect(mapLegacyStatus(status).statusV2).toBe(status));
 it('retains hold and terminal flags',()=>{
  expect(mapLegacyStatus('ON_HOLD').onHold).toBe(true);
  expect(mapLegacyStatus('COMPLETED').completionType).toBe('COMPLETE');
  expect(mapLegacyStatus('CANCELLED').completionType).toBe('CANCELLED');
 });
 it('preserves historical enum values without inventing a new status',()=>expect(mapLegacyStatus('READY_FOR_INSTALL').statusV2).toBe('READY_FOR_INSTALL'));
});

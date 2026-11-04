import { afterEach, describe, it, expect, vi } from 'vitest';
const db=vi.hoisted(()=>({prisma:{order:{findUnique:vi.fn(),update:vi.fn()}}}));
vi.mock('@/lib/db',()=>db);
import { AddressIntelligenceService } from '@/lib/services/address/AddressIntelligenceService';
afterEach(()=>vi.unstubAllEnvs());
describe('business-mode address privacy',()=>{
 it('validates an order address without sending it to an external geocoder',async()=>{
  vi.stubEnv('TENANT_ENFORCEMENT','true');
  const geocode=vi.fn(); const service=new AddressIntelligenceService({geocode});
  db.prisma.order.findUnique.mockResolvedValueOnce({id:'o1',shippingAddress:{city:'חיפה',street:'הרצל',number:'5'}});
  const result=await service.normalizeOrderAddress('o1');
  expect(result?.validationStatus).toBe('VALID');expect(geocode).not.toHaveBeenCalled();
  expect(db.prisma.order.update.mock.calls[0][0].data.latitude).toBeUndefined();
 });
});
describe('MVP address normalization without AI inference',()=>{
 const geocode=vi.fn(); const service=new AddressIntelligenceService({geocode});
 it('requires actual structured address fields instead of inventing them from raw text',async()=>{
  const result=await service.normalizeAddress({addressRaw:'הרצל 5, חיפה'});
  expect(result.validationStatus).toBe('MISSING');expect(result.street).toBeNull();expect(geocode).not.toHaveBeenCalled();
 });
 it('keeps a complete operator address and its apartment',async()=>{
  const result=await service.normalizeAddress({city:'חיפה',street:'הרצל',houseNumber:'5',floor:'2',apartment:'7'});
  expect(result.validationStatus).toBe('VALID');expect(result.formattedAddress).toBe('הרצל, 5, חיפה');expect(result.apartment).toBe('7');
 });
 it('marks an empty address as missing',async()=>expect((await service.normalizeAddress({})).validationStatus).toBe('MISSING'));
});

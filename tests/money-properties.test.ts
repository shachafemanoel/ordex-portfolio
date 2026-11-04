import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cents, transformOrder } from '@/lib/integrations/woocommerce/transform';
import { wooOrder } from './support/wooMockStore';
// The former raw SQL cases targeted removed order_number/subtotal_cents columns and returned
// before assertions without a DB. Current restricted-DB coverage is verify-payment-departure.ts.
describe('source money properties',()=>{
 it('round-trips all supported cent values without float precision loss',()=>fc.assert(fc.property(fc.integer({min:0,max:2147483647}),value=>{
  expect(cents(`${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`)).toBe(value);
 })));
 it('rejects a source total that differs by any nonzero cent amount',()=>fc.assert(fc.property(fc.integer({min:1,max:10000}),delta=>{
  expect(()=>transformOrder(wooOrder(1,{total:((45000+delta)/100).toFixed(2)}))).toThrow('INCONSISTENT_TOTALS');
 })));
});

import { describe, it, expect } from 'vitest';
import { mapProductToSkus, mapVariationToSku } from '@/lib/woocommerce/sync-transform';
import simple from '../../fixtures/woo/simple-product.json';
import variable from '../../fixtures/woo/variable-product.json';
import variations from '../../fixtures/woo/variations-202.json';

describe('woo transform', () => {
  it('maps simple product to one SKU', () => {
    const out = mapProductToSkus(simple as any);
    expect(out.length).toBe(1);
    const sku = out[0];
    expect(sku.skuCode).toBe('CHAIR-001');
    expect(sku.name).toBe('Office Chair');
    expect(sku.unitPrice).toBe(349);
    expect(sku.stockQty).toBe(12);
    expect(sku.images[0].src).toContain('chair.jpg');
    expect(sku.categories).toContain('chairs');
    expect(sku.wooProductId).toBe(101);
    expect(sku.wooVariantId).toBe(null);
  });

  it('skips parent for variable product', () => {
    const out = mapProductToSkus(variable as any);
    expect(out.length).toBe(0);
  });

  it('maps variation to SKU with attributes in name and fallback sku code', () => {
    const p = variable as any;
    const v = (variations as any[])[1]; // one without sku
    const sku = mapVariationToSku(p, v);
    expect(sku.name).toContain('Desk');
    expect(sku.name).toContain('160cm');
    expect(sku.skuCode).toBe(`ORDX-${p.id}-${v.id}`);
    expect(sku.unitPrice).toBe(790);
    expect(sku.stockQty).toBe(2);
    expect(sku.wooProductId).toBe(202);
    expect(sku.wooVariantId).toBe(3002);
  });
});


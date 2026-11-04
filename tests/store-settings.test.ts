import { describe, expect, it } from 'vitest';

import { resolveStoreRouteOrigin, storeSettingsSchema } from '@/lib/store-settings-schema';

describe('store settings route origin', () => {
  it('uses the store address when configured as the route origin', () => {
    const settings = storeSettingsSchema.parse({
      storeName: 'Ordex',
      storeEmail: '',
      storePhone: '',
      storeAddressLine: 'המסגר 12',
      storeCity: 'תל אביב',
      defaultCurrency: 'ILS',
      timezone: 'Asia/Jerusalem',
      language: 'he',
      taxRatePercent: 18,
      lowStockThreshold: 3,
      autoPurchaseOrder: true,
      orderNumberPrefix: 'ORD-',
      useStoreAddressAsWarehouse: true,
      warehouseAddressLine: 'החרושת 5',
      warehouseCity: 'חולון',
      warehouseLat: 32.0,
      warehouseLng: 34.8,
    });

    expect(resolveStoreRouteOrigin(settings)).toEqual({
      addressLine: 'המסגר 12',
      city: 'תל אביב',
      lat: null,
      lng: null,
      label: 'המסגר 12, תל אביב',
      mode: 'store',
    });
  });

  it('uses the dedicated warehouse address when a custom pickup origin is configured', () => {
    const settings = storeSettingsSchema.parse({
      storeName: 'Ordex',
      storeEmail: '',
      storePhone: '',
      storeAddressLine: 'המסגר 12',
      storeCity: 'תל אביב',
      defaultCurrency: 'ILS',
      timezone: 'Asia/Jerusalem',
      language: 'he',
      taxRatePercent: 18,
      lowStockThreshold: 3,
      autoPurchaseOrder: true,
      orderNumberPrefix: 'ORD-',
      useStoreAddressAsWarehouse: false,
      warehouseAddressLine: 'החרושת 5',
      warehouseCity: 'חולון',
      warehouseLat: 32.017,
      warehouseLng: 34.779,
    });

    expect(resolveStoreRouteOrigin(settings)).toEqual({
      addressLine: 'החרושת 5',
      city: 'חולון',
      lat: 32.017,
      lng: 34.779,
      label: 'החרושת 5, חולון',
      mode: 'warehouse',
    });
  });
});

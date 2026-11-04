import { isMvpApiAllowed } from '@/lib/tenancy/mvp-routes';
import { describe, expect, it } from 'vitest';

describe('demo server boundary', () => {
  it.each([
    '/api/ai/query',
    '/api/agents/research',
    '/api/management/overview',
    '/api/dashboard/metrics',
    '/api/reports/purchase',
    '/api/purchase-orders',
    '/api/receiving',
    '/api/notifications/preferences',
    '/api/users/id/token',
    '/api/auth/register',
    '/api/calendar',
    '/api/installations/slots',
    '/api/tasks',
    '/api/orders/id/operational-email',
    '/api/orders/id/operational-whatsapp',
    '/api/orders/id/workflow',
    '/api/orders/id/tasks/active/complete',
  ])('blocks frozen API %s for every method', (path) => {
    for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
      expect(isMvpApiAllowed(path, method)).toBe(false);
  });
  it.each([
    '/api/orders',
    '/api/orders/id/status',
    '/api/orders/id/override-status',
    '/api/orders/id/address',
    '/api/orders/id/schedule',
    '/api/customers',
    '/api/integrations/woocommerce/preview',
    '/api/integrations/woocommerce/import',
    '/api/integrations/woocommerce/jobs/id/retry',
  ])('retains the active API %s', (path) => expect(isMvpApiAllowed(path, 'POST')).toBe(true));
  it('makes user creation unavailable and preserves member lookup', () => {
    expect(isMvpApiAllowed('/api/users', 'POST')).toBe(false);
    expect(isMvpApiAllowed('/api/users', 'GET')).toBe(true);
  });
});

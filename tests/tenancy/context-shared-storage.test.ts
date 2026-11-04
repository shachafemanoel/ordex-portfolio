import { describe, expect, it, vi } from 'vitest';

describe('tenant context storage', () => {
  it('is shared by every copy of the module, so a context set by one copy is seen by another', async () => {
    const first = await import('@/lib/tenancy/context');
    vi.resetModules();
    const second = await import('@/lib/tenancy/context');
    expect(second).not.toBe(first);

    const seen = await first.withTenantContext({ tenantId: 'tenant-a', userId: 'user-1', role: 'OPERATIONS' }, () =>
      second.requireTenantContext()
    );
    expect(seen).toEqual({ tenantId: 'tenant-a', userId: 'user-1', role: 'OPERATIONS' });
  });
});

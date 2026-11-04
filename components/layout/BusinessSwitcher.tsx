'use client';

import { getAuthToken } from '@/lib/auth/tokenStorage';
import { enterBusiness } from '@/lib/tenancy/client';
import { useEffect, useState } from 'react';

type Membership = { tenantId: string; tenant: { name: string } };
export function BusinessSwitcher() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [active, setActive] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    try {
      const response = await fetch('/api/auth/tenants', {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error();
      setMemberships(result.data.memberships);
      setActive(result.data.activeTenantId);
      setError('');
    } catch {
      setError('לא ניתן לטעון עסקים');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (error)
    return (
      <button className="text-sm underline" onClick={load}>
        {error} — ניסיון חוזר
      </button>
    );
  return (
    <label className="grid gap-1 text-sm">
      העסק הפעיל
      <select
        aria-label="העסק הפעיל"
        value={active}
        disabled={busy || !memberships.length}
        className="max-w-64 rounded-lg border border-subtle bg-surface p-2"
        onChange={async (event) => {
          if (
            !window.confirm('מעבר עסק יסגור את המסך הנוכחי וימחק טיוטות מקומיות שלא נשמרו. להמשיך?')
          )
            return;
          setBusy(true);
          try {
            const response = await fetch('/api/auth/tenant', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getAuthToken() || ''}`,
              },
              body: JSON.stringify({ tenantId: event.target.value }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error();
            enterBusiness(result.data.token);
          } catch {
            setError('מעבר העסק נכשל');
            setBusy(false);
          }
        }}
      >
        {!memberships.length && <option value="">טוען עסקים…</option>}
        {memberships.map((member) => (
          <option key={member.tenantId} value={member.tenantId}>
            {member.tenant.name}
          </option>
        ))}
      </select>
    </label>
  );
}

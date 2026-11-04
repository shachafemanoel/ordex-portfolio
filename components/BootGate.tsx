'use client';
import { useEffect, useState } from 'react';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export default function BootGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'init' | 'waking' | 'offline' | 'ready'>('init');

  useEffect(() => {
    const timer7 = setTimeout(() => setState((s) => (s === 'init' ? 'waking' : s)), 7000);
    const timer25 = setTimeout(() => setState((s) => (s === 'ready' ? 'ready' : 'offline')), 25000);
    fetchWithTimeout('/api/bootstrap', {}, 15000)
      .then(() => setState('ready'))
      .catch(() => setState('waking'));
    return () => {
      clearTimeout(timer7);
      clearTimeout(timer25);
    };
  }, []);

  if (state === 'ready') return <>{children}</>;
  if (state === 'offline')
    return (
      <div style={{ padding: 16 }}>
        <h3>השרת מתעורר לאט</h3>
        <p>זה עלול לקחת עד דקה. נסה לרענן.</p>
        <button onClick={() => location.reload()}>רענון</button>
      </div>
    );
  return (
    <div style={{ padding: 16 }}>
      <p>טוען נתונים…</p>
      {state === 'waking' && <p>השרת מתעורר. ייתכן עיכוב קצר.</p>}
    </div>
  );
}

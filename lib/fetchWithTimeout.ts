export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 15000
) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  } finally {
    clearTimeout(id);
  }
}

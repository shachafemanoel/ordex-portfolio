import { lookup } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';

// The server calls a store address a user typed in, so it must never reach the internal network,
// the cloud metadata service or the machine itself. Every connection resolves the host again and
// checks each address, which also covers DNS rebinding between the check and the request.

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

/**
 * Local store mocks in development and the acceptance tests only. Those run `next start`, so
 * NODE_ENV is "production" there; the deployed production service sets APP_ENV=production
 * (render.yaml), and that always wins.
 */
export function privateHostsAllowed(): boolean {
  return process.env.WOO_ALLOW_PRIVATE_HOSTS === 'true' && process.env.APP_ENV !== 'production';
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return blocked.check(mapped[1], 'ipv4');
    return blocked.check(address, 'ipv6');
  }
  return true;
}

export class StoreAddressError extends Error {
  constructor() {
    super('כתובת החנות חייבת להתחיל ב-https:// ולהוביל לאתר ציבורי');
    this.name = 'StoreAddressError';
  }
}

/** Accepts what a person types ("shop.co.il/", "https://shop.co.il/he") and returns the store root. */
export function normalizeStoreUrl(input: string): URL {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new StoreAddressError();
  }
  const httpAllowed = privateHostsAllowed() && url.protocol === 'http:';
  if ((url.protocol !== 'https:' && !httpAllowed) || url.username || url.password) {
    throw new StoreAddressError();
  }
  if (!isAllowedLiteralHost(url)) throw new StoreAddressError();
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}

/** Node does not call `lookup` for an IP literal, so those are checked here before any request. */
export function isAllowedLiteralHost(url: URL): boolean {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return privateHostsAllowed() || !isIP(host) || !isBlockedAddress(host);
}

/** A `lookup` for http(s).request that refuses private addresses at connection time. */
export function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
): void {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const list = addresses as LookupAddress[];
    if (!privateHostsAllowed() && (!list.length || list.some((entry) => isBlockedAddress(entry.address)))) {
      const refused: NodeJS.ErrnoException = new StoreAddressError();
      refused.code = 'EADDRBLOCKED';
      return callback(refused, []);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

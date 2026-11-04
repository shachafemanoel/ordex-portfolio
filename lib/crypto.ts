import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('Missing ENCRYPTION_KEY');
  const buf = Buffer.from(raw.length === 64 ? raw : raw, raw.length === 64 ? 'hex' : 'base64');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (hex or base64)');
  return buf;
}

export function encryptSecret(plain: unknown) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = typeof plain === 'string' ? plain : JSON.stringify(plain);
  const enc = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipher: enc, iv, tag };
}

export function decryptSecret(cipher: Buffer, iv: Buffer, tag: Buffer) {
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(cipher), decipher.final()]);
  const txt = dec.toString('utf8');
  try {
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

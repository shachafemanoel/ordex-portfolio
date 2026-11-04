import { describe, expect, it } from 'vitest';
import {
  buildMultipartEmail,
  encodeRfc2047Subject,
  toGmailRawBase64,
} from '@/lib/services/google-workspace/gmailMime';

describe('encodeRfc2047Subject', () => {
  it('returns ASCII unchanged', () => {
    expect(encodeRfc2047Subject('Hello')).toBe('Hello');
  });

  it('encodes Hebrew with UTF-8 B encoding', () => {
    const s = encodeRfc2047Subject('שלום');
    expect(s).toMatch(/^=\?UTF-8\?B\?/);
    expect(s).toMatch(/\?=$/);
  });
});

describe('toGmailRawBase64', () => {
  it('produces URL-safe base64 without padding', () => {
    const raw = 'Subject: test\r\n\r\nHi';
    const b64 = toGmailRawBase64(raw);
    expect(b64).not.toContain('+');
    expect(b64).not.toContain('/');
    expect(b64.endsWith('=')).toBe(false);
  });
});

describe('buildMultipartEmail', () => {
  it('includes multipart boundary and encoded subject', () => {
    const msg = buildMultipartEmail({
      from: 'a@x.com',
      to: 'b@y.com',
      subject: 'Test',
      textPlain: 'plain',
      textHtml: '<p>html</p>',
    });
    expect(msg).toContain('multipart/alternative');
    expect(msg).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(msg).toContain('Content-Type: text/html; charset=UTF-8');
    expect(msg).toMatch(/^From: a@x\.com\r\n/m);
  });
});

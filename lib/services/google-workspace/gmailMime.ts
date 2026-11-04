import { randomBytes } from 'crypto';

/** RFC 2047 encoded-word for UTF-8 subject (B encoding). */
export function encodeRfc2047Subject(subject: string): string {
  if (!/[^\x00-\x7F]/.test(subject)) {
    return subject;
  }
  const b64 = Buffer.from(subject, 'utf8').toString('base64');
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 60) {
    chunks.push(b64.slice(i, i + 60));
  }
  return `=?UTF-8?B?${chunks.join('?=\r\n =?UTF-8?B?')}?=`;
}

function b64Part(body: string): string {
  return Buffer.from(body, 'utf8').toString('base64').replace(/\r?\n/g, '');
}

/**
 * Build RFC 2822 message with multipart/alternative (plain + HTML), UTF-8 parts as base64.
 * Headers use CRLF; body uses CRLF throughout.
 */
export function buildMultipartEmail(params: {
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  textPlain: string;
  textHtml: string;
}): string {
  const boundary = `ordex_${randomBytes(12).toString('hex')}`;
  const ccLine =
    params.cc?.length && params.cc.length > 0
      ? `Cc: ${params.cc.join(', ')}\r\n`
      : '';

  const plainB64 = b64Part(params.textPlain);
  const htmlB64 = b64Part(params.textHtml);

  const inner = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    plainB64,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const headers = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    ccLine.trimEnd() ? `${ccLine}` : '',
    `Subject: ${encodeRfc2047Subject(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ]
    .filter(Boolean)
    .join('\r\n');

  return `${headers}\r\n${inner}`;
}

/** Gmail API `raw`: web-safe base64 without padding (base64url). */
export function toGmailRawBase64(rfc2822: string): string {
  return Buffer.from(rfc2822, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

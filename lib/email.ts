import { getFeatureEnv } from '@/lib/env';

// Send email via SendGrid API if configured; otherwise fail gracefully
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  attachment?: { filename: string; content: string; type?: string }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const integrationsEnv = getFeatureEnv('integrations');
    if (!integrationsEnv?.SENDGRID_API_KEY) {
      console.warn('SendGrid not configured');
      return { success: false, error: 'Email not configured' };
    }

    const body: any = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'no-reply@ordex.app', name: 'רצף' },
      subject,
      content: [{ type: 'text/plain', value: text }],
    };

    if (attachment) {
      body.attachments = [
        {
          content: Buffer.from(attachment.content).toString('base64'),
          filename: attachment.filename,
          type: attachment.type || 'text/csv',
          disposition: 'attachment',
        },
      ];
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integrationsEnv.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Email send failed', res.status, txt);
      return { success: false, error: `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('Email error:', msg);
    return { success: false, error: msg };
  }
}

import { getFeatureEnv } from '@/lib/env';

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const whatsappEnv = getFeatureEnv('whatsapp');
    if (!whatsappEnv?.WHATSAPP_TOKEN || !whatsappEnv?.WHATSAPP_PHONE_ID) {
      console.warn('WhatsApp not configured');
      return { success: false, error: 'WhatsApp not configured' };
    }

    const url = `https://graph.facebook.com/v18.0/${whatsappEnv.WHATSAPP_PHONE_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsappEnv.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('WhatsApp send failed:', res.status, txt);
      return { success: false, error: `HTTP ${res.status}` };
    }
    const data: any = await res.json().catch(() => ({}));
    return { success: true, id: data?.messages?.[0]?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('WhatsApp error:', msg);
    return { success: false, error: msg };
  }
}

/** פרמטרים לתבנית Meta לפי סדר המקומות בגוף ההודעה ({{1}}, {{2}}, …). */
export async function sendMetaTemplateOrderedParams(
  to: string,
  templateName: string,
  bodyParameterTexts: string[]
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const whatsappEnv = getFeatureEnv('whatsapp');
    if (!whatsappEnv?.WHATSAPP_TOKEN || !whatsappEnv?.WHATSAPP_PHONE_ID) {
      console.warn('WhatsApp not configured');
      return { success: false, error: 'WhatsApp not configured' };
    }

    const templateParameters = bodyParameterTexts.map((value) => ({
      type: 'text' as const,
      text: String(value ?? ''),
    }));
    const url = `https://graph.facebook.com/v18.0/${whatsappEnv.WHATSAPP_PHONE_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsappEnv.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'he' },
          components: templateParameters.length
            ? [{ type: 'body', parameters: templateParameters }]
            : undefined,
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('WhatsApp template send failed:', res.status, txt);
      return { success: false, error: `HTTP ${res.status}` };
    }
    const data: any = await res.json().catch(() => ({}));
    return { success: true, id: data?.messages?.[0]?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('WhatsApp template error:', msg);
    return { success: false, error: msg };
  }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  parameters: Record<string, string>
): Promise<{ success: boolean; error?: string; id?: string }> {
  return sendMetaTemplateOrderedParams(to, templateName, Object.values(parameters ?? {}));
}

export const whatsapp = {
  sendTemplateMessage,
};

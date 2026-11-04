import {
  buildMultipartEmail,
  toGmailRawBase64,
} from '@/lib/services/google-workspace/gmailMime';
import { GoogleWorkspaceClient } from '@/lib/services/google-workspace/GoogleWorkspaceClient';
import { withGoogleRetries } from '@/lib/services/google-workspace/googleRetry';

export type GmailSendParams = {
  storeId: string;
  fromMailbox: string;
  to: string;
  cc?: string[];
  subject: string;
  textPlain: string;
  textHtml: string;
};

export class GmailSendService {
  constructor(private readonly client = new GoogleWorkspaceClient()) {}

  async send(params: GmailSendParams): Promise<{ messageId: string; threadId?: string }> {
    const rfc2822 = buildMultipartEmail({
      from: params.fromMailbox,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      textPlain: params.textPlain,
      textHtml: params.textHtml,
    });
    const raw = toGmailRawBase64(rfc2822);

    const { gmail } = await this.client.getGmailAndCalendar(params.storeId);

    const res = await withGoogleRetries(() =>
      gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      })
    );

    const id = res.data.id;
    if (!id) {
      throw new Error('Gmail send succeeded but no message id returned');
    }

    return { messageId: id, threadId: res.data.threadId ?? undefined };
  }
}

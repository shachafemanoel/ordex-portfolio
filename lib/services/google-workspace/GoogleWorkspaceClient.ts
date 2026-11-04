import { getGoogleOAuthClientConfig } from '@/lib/integrations/google/oauthConfig';
import { google } from 'googleapis';
import { GoogleOAuthCredentialsService } from '@/lib/services/google-workspace/GoogleOAuthCredentialsService';

function buildOAuth2() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthClientConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export class GoogleWorkspaceClient {
  constructor(private readonly credentials = new GoogleOAuthCredentialsService()) {}

  async getGmailAndCalendar(storeId: string) {
    const { accessToken } = await this.credentials.getValidAccessToken(storeId);
    const oauth2 = buildOAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    return {
      gmail: google.gmail({ version: 'v1', auth: oauth2 }),
      calendar: google.calendar({ version: 'v3', auth: oauth2 }),
    };
  }

  getCredentialsService() {
    return this.credentials;
  }
}

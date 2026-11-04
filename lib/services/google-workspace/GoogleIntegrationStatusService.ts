import { prisma } from '@/lib/db';
import { GoogleOAuthCredentialsService } from '@/lib/services/google-workspace/GoogleOAuthCredentialsService';

export class GoogleIntegrationStatusService {
  constructor(private readonly oauth = new GoogleOAuthCredentialsService()) {}

  async getPublicStatus(storeId: string) {
    const row = await this.oauth.getStatus(storeId);
    if (!row) {
      return {
        connected: false as const,
        oauthConfigured: this.oauth.isConfigured(),
      };
    }
    return {
      connected: true as const,
      oauthConfigured: this.oauth.isConfigured(),
      connectedEmail: row.connectedEmail,
      status: row.status,
      scopes: row.scopes,
      lastTokenError: row.lastTokenError,
      connectedAt: row.connectedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

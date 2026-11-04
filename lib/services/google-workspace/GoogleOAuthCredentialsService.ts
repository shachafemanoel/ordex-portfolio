import { decryptSecret, encryptSecret } from '@/lib/crypto';
import {
  GoogleIntegrationInvalidError,
  GoogleIntegrationMissingError,
  GoogleOAuthConfigError,
  isInvalidGrantError,
} from '@/lib/integrations/google/errors';
import {
  getGoogleOAuthClientConfig,
  GOOGLE_OAUTH_SCOPES,
} from '@/lib/integrations/google/oauthConfig';
import { prisma } from '@/lib/db';
import { GoogleWorkspaceIntegrationStatus } from '@prisma/client';
import { google } from 'googleapis';

const ACCESS_SKEW_MS = 90_000;

function buildOAuth2() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthClientConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export class GoogleOAuthCredentialsService {
  generateAuthorizationUrl(state: string): string {
    const oauth2 = buildOAuth2();
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [...GOOGLE_OAUTH_SCOPES],
      include_granted_scopes: true,
      state,
    });
  }

  async exchangeCodeAndPersist(params: {
    storeId: string;
    code: string;
    connectedByUserId: string;
  }): Promise<{ connectedEmail: string }> {
    const oauth2 = buildOAuth2();
    const { tokens } = await oauth2.getToken(params.code);
    if (!tokens.refresh_token) {
      throw new Error(
        'No refresh token returned. Revoke app access in Google Account and reconnect with prompt=consent.'
      );
    }

    const refreshEnc = encryptSecret(tokens.refresh_token);
    const accessEnc =
      tokens.access_token && tokens.expiry_date
        ? encryptSecret(tokens.access_token)
        : null;

    const oauth2Authed = buildOAuth2();
    oauth2Authed.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Authed });
    const userInfo = await oauth2Api.userinfo.get();
    const connectedEmail = userInfo.data.email ?? '';

    await prisma.workspaceGoogleIntegration.upsert({
      where: { storeId: params.storeId },
      create: {
        storeId: params.storeId,
        status: GoogleWorkspaceIntegrationStatus.ACTIVE,
        connectedEmail: connectedEmail || 'unknown@unknown',
        scopes: tokens.scope?.split(' ').filter(Boolean) ?? [...GOOGLE_OAUTH_SCOPES],
        refreshTokenCipher: Buffer.from(refreshEnc.cipher),
        refreshTokenIv: Buffer.from(refreshEnc.iv),
        refreshTokenTag: Buffer.from(refreshEnc.tag),
        accessTokenCipher: accessEnc ? Buffer.from(accessEnc.cipher) : null,
        accessTokenIv: accessEnc ? Buffer.from(accessEnc.iv) : null,
        accessTokenTag: accessEnc ? Buffer.from(accessEnc.tag) : null,
        accessTokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        connectedByUserId: params.connectedByUserId,
        lastTokenError: null,
      },
      update: {
        status: GoogleWorkspaceIntegrationStatus.ACTIVE,
        connectedEmail: connectedEmail || 'unknown@unknown',
        scopes: tokens.scope?.split(' ').filter(Boolean) ?? [...GOOGLE_OAUTH_SCOPES],
        refreshTokenCipher: Buffer.from(refreshEnc.cipher),
        refreshTokenIv: Buffer.from(refreshEnc.iv),
        refreshTokenTag: Buffer.from(refreshEnc.tag),
        accessTokenCipher: accessEnc ? Buffer.from(accessEnc.cipher) : null,
        accessTokenIv: accessEnc ? Buffer.from(accessEnc.iv) : null,
        accessTokenTag: accessEnc ? Buffer.from(accessEnc.tag) : null,
        accessTokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        connectedByUserId: params.connectedByUserId,
        lastTokenError: null,
      },
    });

    return { connectedEmail };
  }

  async getValidAccessToken(storeId: string): Promise<{ accessToken: string; connectedEmail: string }> {
    const row = await prisma.workspaceGoogleIntegration.findUnique({
      where: { storeId },
    });

    if (!row) {
      throw new GoogleIntegrationMissingError();
    }

    if (row.status !== GoogleWorkspaceIntegrationStatus.ACTIVE) {
      throw new GoogleIntegrationInvalidError();
    }

    const now = Date.now();
    if (
      row.accessTokenExpiresAt &&
      row.accessTokenCipher &&
      row.accessTokenIv &&
      row.accessTokenTag &&
      row.accessTokenExpiresAt.getTime() - ACCESS_SKEW_MS > now
    ) {
      const accessToken = decryptSecret(
        Buffer.from(row.accessTokenCipher),
        Buffer.from(row.accessTokenIv),
        Buffer.from(row.accessTokenTag)
      );
      if (typeof accessToken === 'string') {
        return { accessToken, connectedEmail: row.connectedEmail };
      }
    }

    const refreshToken = decryptSecret(
      Buffer.from(row.refreshTokenCipher),
      Buffer.from(row.refreshTokenIv),
      Buffer.from(row.refreshTokenTag)
    );
    if (typeof refreshToken !== 'string' || !refreshToken) {
      await this.markRevokedAndClear(storeId, 'Invalid refresh token material');
      throw new GoogleIntegrationInvalidError();
    }

    const oauth2 = buildOAuth2();
    oauth2.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2.refreshAccessToken();
      if (!credentials.access_token) {
        throw new Error('No access_token after refresh');
      }

      const accessEnc = encryptSecret(credentials.access_token);
      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(now + 3_600_000);

      await prisma.workspaceGoogleIntegration.update({
        where: { storeId },
        data: {
          accessTokenCipher: Buffer.from(accessEnc.cipher),
          accessTokenIv: Buffer.from(accessEnc.iv),
          accessTokenTag: Buffer.from(accessEnc.tag),
          accessTokenExpiresAt: expiresAt,
          lastTokenError: null,
          status: GoogleWorkspaceIntegrationStatus.ACTIVE,
        },
      });

      return { accessToken: credentials.access_token, connectedEmail: row.connectedEmail };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isInvalidGrantError(msg)) {
        await this.markRevokedAndClear(storeId, msg);
        throw new GoogleIntegrationInvalidError();
      }
      await prisma.workspaceGoogleIntegration.update({
        where: { storeId },
        data: {
          status: GoogleWorkspaceIntegrationStatus.ERROR,
          lastTokenError: msg,
        },
      });
      throw e;
    }
  }

  private async markRevokedAndClear(storeId: string, reason: string) {
    await prisma.workspaceGoogleIntegration.deleteMany({ where: { storeId } }).catch(() => {
      /* row may already be gone */
    });
    void reason;
  }

  async disconnect(storeId: string): Promise<void> {
    const row = await prisma.workspaceGoogleIntegration.findUnique({ where: { storeId } });
    if (!row) return;

    if (row.status === GoogleWorkspaceIntegrationStatus.ACTIVE) {
      try {
        const { accessToken } = await this.getValidAccessToken(storeId);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).catch(() => undefined);
      } catch {
        /* best-effort revoke */
      }
    }

    await prisma.workspaceGoogleIntegration.delete({ where: { storeId } }).catch(() => undefined);
  }

  async getStatus(storeId: string) {
    const row = await prisma.workspaceGoogleIntegration.findUnique({
      where: { storeId },
      select: {
        connectedEmail: true,
        status: true,
        scopes: true,
        lastTokenError: true,
        connectedAt: true,
        updatedAt: true,
      },
    });
    return row;
  }

  isConfigured(): boolean {
    try {
      getGoogleOAuthClientConfig();
      return true;
    } catch {
      return false;
    }
  }
}

export function assertGoogleOAuthConfigured(): void {
  try {
    getGoogleOAuthClientConfig();
  } catch (e) {
    if (e instanceof GoogleOAuthConfigError) throw e;
    throw new GoogleOAuthConfigError();
  }
}

export class GoogleIntegrationMissingError extends Error {
  readonly code = 'GOOGLE_INTEGRATION_MISSING' as const;
  constructor(message = 'Google Workspace is not connected for this store.') {
    super(message);
    this.name = 'GoogleIntegrationMissingError';
  }
}

export class GoogleIntegrationInvalidError extends Error {
  readonly code = 'GOOGLE_INTEGRATION_INVALID' as const;
  constructor(message = 'Google Workspace connection is invalid or revoked. Reconnect in settings.') {
    super(message);
    this.name = 'GoogleIntegrationInvalidError';
  }
}

export class GoogleOAuthConfigError extends Error {
  readonly code = 'GOOGLE_OAUTH_CONFIG' as const;
  constructor(message = 'Google OAuth client is not configured.') {
    super(message);
    this.name = 'GoogleOAuthConfigError';
  }
}

export class GoogleRateOrTransientError extends Error {
  readonly code = 'GOOGLE_RATE_OR_TRANSIENT' as const;
  readonly retryable = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'GoogleRateOrTransientError';
  }
}

export function isInvalidGrantError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('invalid_grant') || m.includes('token has been expired or revoked');
}

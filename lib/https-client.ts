/**
 * Secure HTTPS Client with SSL/TLS Verification
 * Provides secure HTTP client with certificate validation,
 * timeout handling, and retry mechanisms for external service calls
 */

import https from 'https';
import { URL } from 'url';

// SSL/TLS Configuration
export interface HttpsClientConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
  validateCertificate: boolean;
  allowedCiphers?: string[];
  minTlsVersion?: string;
  maxTlsVersion?: string;
  customCertificates?: Buffer[];
}

// Request options
export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeout?: number;
  validateCertificate?: boolean;
}

// Response interface
export interface SecureResponse {
  status: number;
  headers: Record<string, string>;
  data: Buffer;
  certificateInfo?: CertificateInfo;
}

// Certificate information
export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  isValid: boolean;
}

// Default configuration
const DEFAULT_CONFIG: HttpsClientConfig = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  validateCertificate: true,
  allowedCiphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
  ],
  minTlsVersion: 'TLSv1.2',
  maxTlsVersion: 'TLSv1.3',
};

/**
 * Secure HTTPS Client class
 */
export class SecureHttpsClient {
  private config: HttpsClientConfig;

  constructor(config?: Partial<HttpsClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Make a secure HTTPS request
   */
  async request(url: string, options: RequestOptions = {}): Promise<SecureResponse> {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are allowed');
    }

    const requestOptions = this.buildRequestOptions(parsedUrl, options);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.makeRequest(requestOptions, options.body);
        return response;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Request attempt ${attempt} failed:`, error);

        if (attempt < this.config.retries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Build request options with security settings
   */
  private buildRequestOptions(parsedUrl: URL, options: RequestOptions): https.RequestOptions {
    const timeout = options.timeout || this.config.timeout;
    const validateCertificate = options.validateCertificate ?? this.config.validateCertificate;

    return {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Ordex-OMS/1.0 (Secure HTTPS Client)',
        ...options.headers,
      },
      timeout,
      rejectUnauthorized: validateCertificate,
      secureProtocol: 'TLS_method',
      ciphers: this.config.allowedCiphers?.join(':'),
      minVersion: this.config.minTlsVersion as any,
      maxVersion: this.config.maxTlsVersion as any,
      checkServerIdentity: validateCertificate ? this.checkServerIdentity : undefined,
    };
  }

  /**
   * Custom server identity check
   */
  private checkServerIdentity = (hostname: string, cert: any): Error | undefined => {
    // Additional custom certificate validation logic can be added here
    const standardCheck = https.globalAgent.options.checkServerIdentity?.(hostname, cert);

    if (standardCheck) {
      return standardCheck;
    }

    // Check certificate validity period
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    if (now < validFrom || now > validTo) {
      return new Error(
        `Certificate is not valid for current date. Valid from ${validFrom} to ${validTo}`
      );
    }

    // Additional checks can be added here:
    // - Certificate transparency
    // - OCSP stapling
    // - Custom CA validation

    return undefined;
  };

  /**
   * Make the actual HTTPS request
   */
  private makeRequest(
    requestOptions: https.RequestOptions,
    body?: string | Buffer
  ): Promise<SecureResponse> {
    return new Promise((resolve, reject) => {
      const request = https.request(requestOptions, (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const data = Buffer.concat(chunks);
          const headers: Record<string, string> = {};

          Object.entries(response.headers).forEach(([key, value]) => {
            headers[key] = Array.isArray(value) ? value.join(', ') : value || '';
          });

          const certificateInfo = this.extractCertificateInfo(response.socket);

          resolve({
            status: response.statusCode || 0,
            headers,
            data,
            certificateInfo,
          });
        });
      });

      request.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timed out'));
      });

      // Handle TLS/SSL specific errors
      request.on('tlsClientError', (error) => {
        reject(new Error(`TLS error: ${error.message}`));
      });

      if (body) {
        request.write(body);
      }

      request.end();
    });
  }

  /**
   * Extract certificate information from the socket
   */
  private extractCertificateInfo(socket: any): CertificateInfo | undefined {
    if (!socket || !socket.getPeerCertificate) {
      return undefined;
    }

    try {
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.subject) {
        return undefined;
      }

      return {
        subject: this.formatCertificateName(cert.subject),
        issuer: this.formatCertificateName(cert.issuer),
        validFrom: new Date(cert.valid_from),
        validTo: new Date(cert.valid_to),
        fingerprint: cert.fingerprint,
        isValid:
          cert.valid_from &&
          cert.valid_to &&
          new Date() >= new Date(cert.valid_from) &&
          new Date() <= new Date(cert.valid_to),
      };
    } catch (error) {
      console.warn('Failed to extract certificate info:', error);
      return undefined;
    }
  }

  /**
   * Format certificate subject/issuer name
   */
  private formatCertificateName(name: any): string {
    if (typeof name === 'string') {
      return name;
    }

    const parts: string[] = [];
    if (name.CN) parts.push(`CN=${name.CN}`);
    if (name.O) parts.push(`O=${name.O}`);
    if (name.OU) parts.push(`OU=${name.OU}`);
    if (name.C) parts.push(`C=${name.C}`);

    return parts.join(', ') || 'Unknown';
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  async get(url: string, headers?: Record<string, string>): Promise<SecureResponse> {
    return this.request(url, { method: 'GET', headers });
  }

  /**
   * POST request
   */
  async post(
    url: string,
    body: string | Buffer | object,
    headers?: Record<string, string>
  ): Promise<SecureResponse> {
    const requestBody =
      typeof body === 'object' && !Buffer.isBuffer(body)
        ? JSON.stringify(body)
        : (body as string | Buffer);

    const requestHeaders = {
      'Content-Type':
        typeof body === 'object' && !Buffer.isBuffer(body)
          ? 'application/json'
          : 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(requestBody).toString(),
      ...headers,
    };

    return this.request(url, {
      method: 'POST',
      body: requestBody,
      headers: requestHeaders,
    });
  }

  /**
   * PUT request
   */
  async put(
    url: string,
    body: string | Buffer | object,
    headers?: Record<string, string>
  ): Promise<SecureResponse> {
    const requestBody =
      typeof body === 'object' && !Buffer.isBuffer(body)
        ? JSON.stringify(body)
        : (body as string | Buffer);

    const requestHeaders = {
      'Content-Type':
        typeof body === 'object' && !Buffer.isBuffer(body)
          ? 'application/json'
          : 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(requestBody).toString(),
      ...headers,
    };

    return this.request(url, {
      method: 'PUT',
      body: requestBody,
      headers: requestHeaders,
    });
  }

  /**
   * DELETE request
   */
  async delete(url: string, headers?: Record<string, string>): Promise<SecureResponse> {
    return this.request(url, { method: 'DELETE', headers });
  }

  /**
   * Verify SSL certificate of a domain
   */
  async verifyCertificate(hostname: string, port: number = 443): Promise<CertificateInfo> {
    const url = `https://${hostname}:${port}/`;

    try {
      const response = await this.get(url);

      if (!response.certificateInfo) {
        throw new Error('No certificate information available');
      }

      return response.certificateInfo;
    } catch (error) {
      throw new Error(
        `Certificate verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Default secure client instance
export const secureHttpsClient = new SecureHttpsClient();

/**
 * Utility functions for common external service calls
 */

// Google APIs client
export const googleApiClient = new SecureHttpsClient({
  timeout: 15000,
  retries: 2,
  allowedCiphers: ['ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES256-GCM-SHA384'],
});

// Stripe API client
export const stripeApiClient = new SecureHttpsClient({
  timeout: 20000,
  retries: 3,
  retryDelay: 2000,
});

// Twilio API client
export const twilioApiClient = new SecureHttpsClient({
  timeout: 10000,
  retries: 2,
});

// WooCommerce API client
export const wooCommerceApiClient = new SecureHttpsClient({
  timeout: 30000,
  retries: 3,
  validateCertificate: true, // Important for e-commerce
});

/**
 * Certificate monitoring utility
 */
export class CertificateMonitor {
  private clients: Map<string, SecureHttpsClient> = new Map();

  constructor() {
    this.clients.set('google', googleApiClient);
    this.clients.set('stripe', stripeApiClient);
    this.clients.set('twilio', twilioApiClient);
    this.clients.set('woocommerce', wooCommerceApiClient);
  }

  /**
   * Check certificate health for all monitored services
   */
  async checkAllCertificates(): Promise<Record<string, CertificateInfo | { error: string }>> {
    const results: Record<string, CertificateInfo | { error: string }> = {};

    const services: Array<{ name: string; hostname: string }> = [
      { name: 'google-apis', hostname: 'googleapis.com' },
      { name: 'google-oauth', hostname: 'oauth2.googleapis.com' },
      { name: 'stripe', hostname: 'api.stripe.com' },
      { name: 'twilio', hostname: 'api.twilio.com' },
    ];

    // Add WooCommerce if configured
    if (process.env.WOOCOMMERCE_STORE_URL) {
      try {
        const wooUrl = new URL(process.env.WOOCOMMERCE_STORE_URL);
        services.push({ name: 'woocommerce', hostname: wooUrl.hostname });
      } catch (error) {
        results['woocommerce'] = { error: 'Invalid WooCommerce URL' };
      }
    }

    await Promise.allSettled(
      services.map(async (service: { name: string; hostname: string }) => {
        try {
          const key = service.name.split('-')[0] || service.name;
          const client = this.clients.get(key) || secureHttpsClient;
          const certInfo = await client.verifyCertificate(String(service.hostname));
          results[service.name] = certInfo;
        } catch (error) {
          results[service.name] = {
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results;
  }

  /**
   * Get certificates expiring soon
   */
  getCertificatesExpiringSoon(
    certificates: Record<string, CertificateInfo | { error: string }>,
    daysThreshold: number = 30
  ): Record<string, CertificateInfo> {
    const expiringSoon: Record<string, CertificateInfo> = {};
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    Object.entries(certificates).forEach(([name, certInfo]) => {
      if ('validTo' in certInfo && certInfo.validTo <= thresholdDate) {
        expiringSoon[name] = certInfo;
      }
    });

    return expiringSoon;
  }
}

export const certificateMonitor = new CertificateMonitor();

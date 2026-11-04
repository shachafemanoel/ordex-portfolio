/**
 * WooCommerce Configuration Service
 * Centralized configuration validation and management for WooCommerce integration
 */

import { logger } from '@/lib/logger';

export interface WooCommerceConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  apiVersion: string;
  isConfigured: boolean;
  apiBaseUrl: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: WooCommerceConfig;
}

// Cache for configuration validation to avoid repeated checks
let configCache: WooCommerceConfig | null = null;
let lastValidationTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Validate and normalize WooCommerce URL
 */
function validateAndNormalizeUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  if (!url) {
    return { isValid: false, error: 'URL is empty' };
  }

  try {
    // Remove trailing slash if present
    const cleanUrl = url.replace(/\/$/, '');

    // Check if it starts with http/https
    if (!cleanUrl.match(/^https?:\/\//)) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    // Try to create URL object to validate format
    const urlObj = new URL(cleanUrl);

    // Basic validation
    if (!urlObj.hostname) {
      return { isValid: false, error: 'Invalid hostname in URL' };
    }

    return { isValid: true, normalizedUrl: cleanUrl };
  } catch (error) {
    return { isValid: false, error: `Invalid URL format: ${(error as Error).message}` };
  }
}

/**
 * Validate WooCommerce credentials format
 */
function validateCredentials(consumerKey: string, consumerSecret: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!consumerKey) {
    errors.push('Consumer key is empty');
  } else {
    // WooCommerce consumer keys typically start with 'ck_' and are 27+ chars
    if (consumerKey.length < 10) {
      errors.push('Consumer key appears too short (should be 27+ characters)');
    }
    if (!consumerKey.startsWith('ck_')) {
      errors.push('Consumer key should start with "ck_" (WooCommerce standard)');
    }
  }

  if (!consumerSecret) {
    errors.push('Consumer secret is empty');
  } else {
    // WooCommerce consumer secrets typically start with 'cs_' and are 51+ chars
    if (consumerSecret.length < 10) {
      errors.push('Consumer secret appears too short (should be 51+ characters)');
    }
    if (!consumerSecret.startsWith('cs_')) {
      errors.push('Consumer secret should start with "cs_" (WooCommerce standard)');
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Get and validate WooCommerce configuration
 */
export function getWooCommerceConfig(): ConfigValidationResult {
  if (process.env.TENANT_ENFORCEMENT === 'true') return { isValid: false, errors: ['Per-business WooCommerce connection required'], warnings: [] };
  const now = Date.now();

  // Return cached result if still valid
  if (configCache && (now - lastValidationTime) < CACHE_TTL) {
    return {
      isValid: configCache.isConfigured,
      errors: configCache.isConfigured ? [] : ['Configuration validation failed (cached)'],
      warnings: [],
      config: configCache,
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Get environment variables with fallbacks
  const storeUrl = process.env.WOO_BASE_URL || process.env.WOOCOMMERCE_URL || '';
  const consumerKey = process.env.WOO_CONSUMER_KEY || process.env.WOOCOMMERCE_KEY || '';
  const consumerSecret = process.env.WOO_CONSUMER_SECRET || process.env.WOOCOMMERCE_SECRET || '';

  // Check for missing environment variables
  const missingVars: string[] = [];
  if (!storeUrl) {
    missingVars.push('WOO_BASE_URL or WOOCOMMERCE_URL');
  }
  if (!consumerKey) {
    missingVars.push('WOO_CONSUMER_KEY or WOOCOMMERCE_KEY');
  }
  if (!consumerSecret) {
    missingVars.push('WOO_CONSUMER_SECRET or WOOCOMMERCE_SECRET');
  }

  if (missingVars.length > 0) {
    errors.push(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate URL format
  let normalizedUrl = '';
  let apiBaseUrl = '';
  if (storeUrl) {
    const urlValidation = validateAndNormalizeUrl(storeUrl);
    if (!urlValidation.isValid) {
      errors.push(`Invalid store URL: ${urlValidation.error}`);
    } else {
      normalizedUrl = urlValidation.normalizedUrl!;
      apiBaseUrl = `${normalizedUrl}/wp-json/wc/v3`;
    }
  }

  // Validate credentials format
  if (consumerKey || consumerSecret) {
    const credValidation = validateCredentials(consumerKey, consumerSecret);
    if (!credValidation.isValid) {
      credValidation.errors.forEach(error => warnings.push(`Credential format warning: ${error}`));
    }
  }

  // Create configuration object
  const isConfigured = errors.length === 0;
  const config: WooCommerceConfig = {
    storeUrl: normalizedUrl,
    consumerKey,
    consumerSecret,
    apiVersion: 'v3',
    isConfigured,
    apiBaseUrl,
  };

  // Cache the result
  configCache = config;
  lastValidationTime = now;

  const result: ConfigValidationResult = {
    isValid: isConfigured,
    errors,
    warnings,
    config,
  };

  // Log configuration status
  if (isConfigured) {
    logger.info('WooCommerce configuration validated successfully', {
      storeUrl: normalizedUrl,
      hasValidCredentials: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      component: 'woocommerce-config',
    });
  } else {
    logger.error('WooCommerce configuration validation failed', new Error(`Configuration errors: ${errors.join(', ')}`), {
      configErrors: errors,
      warnings,
      component: 'woocommerce-config',
    });
  }

  return result;
}

/**
 * Test WooCommerce API connectivity
 */
export async function testWooCommerceConnection(config?: WooCommerceConfig): Promise<{
  success: boolean;
  error?: string;
  statusCode?: number;
  responseTime?: number;
}> {
  const startTime = Date.now();

  try {
    const wooConfig = config || getWooCommerceConfig().config;

    if (!wooConfig?.isConfigured) {
      return {
        success: false,
        error: 'WooCommerce not configured',
      };
    }

    // Test with a simple API call to get store info
    const url = `${wooConfig.apiBaseUrl}/system_status`;
    const credentials = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
          'User-Agent': 'OMS-WooCommerce-Integration/2.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        logger.info('WooCommerce connection test successful', {
          responseTime: `${responseTime}ms`,
          statusCode: response.status,
          component: 'woocommerce-config',
        });

        return {
          success: true,
          statusCode: response.status,
          responseTime,
        };
      } else {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;

        // Try to parse JSON error response
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = `${errorMessage}: ${errorData.message}`;
          }
        } catch {
          // Not JSON, use raw text
          if (errorText) {
            errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
          }
        }

        logger.warn('WooCommerce connection test failed', {
          statusCode: response.status,
          error: errorMessage,
          responseTime: `${responseTime}ms`,
          component: 'woocommerce-config',
        });

        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
          responseTime,
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if ((error as any).name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timeout (10 seconds)',
          responseTime,
        };
      }

      return {
        success: false,
        error: `Connection error: ${(error as Error).message}`,
        responseTime,
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('WooCommerce connection test error', error, {
      responseTime: `${responseTime}ms`,
      component: 'woocommerce-config',
    });

    return {
      success: false,
      error: `Test failed: ${(error as Error).message}`,
      responseTime,
    };
  }
}

/**
 * Get configuration status for health checks
 */
export function getConfigurationStatus(): {
  configured: boolean;
  lastValidated: Date | null;
  issues?: string[];
} {
  const validation = getWooCommerceConfig();

  return {
    configured: validation.isValid,
    lastValidated: lastValidationTime > 0 ? new Date(lastValidationTime) : null,
    issues: validation.errors.length > 0 ? validation.errors : undefined,
  };
}

/**
 * Clear configuration cache (useful for tests or when env vars change)
 */
export function clearConfigCache(): void {
  configCache = null;
  lastValidationTime = 0;
}
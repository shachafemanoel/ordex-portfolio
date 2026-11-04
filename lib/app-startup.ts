/**
 * Application Startup Service
 * Initializes all essential services and performs health checks on startup
 */

import { warmupCaches } from '@/lib/cache';
import { CircuitBreakerRegistry } from '@/lib/circuit-breaker';
import { healthMonitor } from '@/lib/health-monitor';
import { ensureDefaultAdminUser } from '@/lib/auth/default-admin';
import { ensureOrdersIndex } from '@/lib/data/ordersRedis';
import { ensureUserRoleEnumCompatibility } from '@/lib/db/user-role-compat';
import { isSimpleOmsMode } from '@/lib/simple-oms';

export interface StartupResult {
  success: boolean;
  services: {
    database: boolean;
    cache: boolean;
    woocommerce: boolean;
  };
  warnings: string[];
  errors: string[];
  duration: number;
}

export class AppStartup {
  private static isInitialized = false;
  private static initPromise: Promise<StartupResult> | null = null;

  static async initialize(): Promise<StartupResult> {
    if (!shouldRunStartupInit()) {
      console.log('⏭️ Skipping AppStartup during build/test phase');
      return {
        success: true,
        services: { database: false, cache: false, woocommerce: false },
        warnings: ['Startup skipped (build/test phase)'],
        errors: [],
        duration: 0,
      };
    }

    if (this.isInitialized) {
      return {
        success: true,
        services: { database: true, cache: true, woocommerce: true },
        warnings: [],
        errors: [],
        duration: 0,
      };
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInitialization();
    const result = await this.initPromise;

    if (result.success) {
      this.isInitialized = true;
    }

    return result;
  }

  private static async performInitialization(): Promise<StartupResult> {
    const startTime = Date.now();
    const services = { database: false, cache: false, woocommerce: false };
    const warnings: string[] = [];
    const errors: string[] = [];

    console.log('🚀 Initializing Ordex OMS application...');

    try {
      // 1. Initialize and test database connection
      console.log('📊 Checking database connection...');
      const dbHealth = await healthMonitor.checkDatabase();
      services.database = dbHealth.status !== 'unhealthy';

      if (!services.database) {
        errors.push(`Database initialization failed: ${dbHealth.message}`);
      } else {
        console.log('✅ Database connection established');

        try {
          const compatibility = await ensureUserRoleEnumCompatibility();
          if (compatibility.repaired) {
            console.log(`🔄 ${compatibility.message}`);
          }

          if (process.env.NODE_ENV !== 'production') {
            console.log('👤 Ensuring default admin user exists for initial login...');
            const result = await ensureDefaultAdminUser();
            if (result.created) {
              console.log(`✅ Default admin user created (${result.email})`);
            } else if (result.updated) {
              console.log(`✅ Default admin user updated (${result.email})`);
            } else {
              console.log(`ℹ️ Default admin user already present (${result.email})`);
            }

            if (result.passwordReset) {
              warnings.push(
                'Default admin user is using the initial password. Please update it after first login.'
              );
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to ensure default admin user: ${message}`);
          console.error('Default admin setup failed:', error);
        }
      }

      // 2. Initialize cache system
      console.log('🗄️  Initializing cache system...');
      try {
        const cacheHealth = await healthMonitor.checkRedisCache();
        services.cache = cacheHealth.status !== 'unhealthy';

        if (cacheHealth.status === 'degraded') {
          warnings.push('Redis cache unavailable, using fallback cache');
        }

        console.log('✅ Cache system initialized');

        const searchIndexReady = await ensureOrdersIndex();
        if (!searchIndexReady) {
          warnings.push('Redis search index unavailable, Redis-backed order search will fall back');
        }
      } catch (error) {
        warnings.push(
          `Cache initialization warning: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        services.cache = true; // Fallback cache should work
      }

      // 3. Reminder system (disabled)

      // 4. Warm up essential caches (non-blocking)
      if (services.database && services.cache) {
        console.log('🔥 Warming up caches...');
        warmupCaches().catch((error) => {
          console.warn('Cache warmup failed:', error);
          warnings.push('Cache warmup failed, will warm on first requests');
        });
      }

      // 5. Test WooCommerce integration
      if (isSimpleOmsMode()) {
        services.woocommerce = true;
        console.log('⏭️ Skipping WooCommerce integration in simple OMS mode');
      } else {
        console.log('🛒 Testing WooCommerce integration...');
        try {
          const wcHealth = await healthMonitor.checkWooCommerceIntegration();
          services.woocommerce = wcHealth.status !== 'unhealthy';

          if (!services.woocommerce) {
            if (wcHealth.message.includes('not configured')) {
              warnings.push('WooCommerce integration not configured - skipping');
              services.woocommerce = true; // Not a critical failure
            } else {
              warnings.push(`WooCommerce integration issues: ${wcHealth.message}`);
            }
          } else {
            console.log('✅ WooCommerce integration ready');
          }
        } catch (error) {
          warnings.push(
            `WooCommerce test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          services.woocommerce = true; // Not critical for startup
        }
      }

      // 6. Initialize circuit breakers
      console.log('🔗 Initializing circuit breakers...');
      const breakerStats = CircuitBreakerRegistry.getAllStats();
      console.log(`✅ ${Object.keys(breakerStats).length} circuit breakers initialized`);

      // 7. Final health summary
      const duration = Date.now() - startTime;
      const success = services.database && services.cache;

      if (success) {
        console.log(`🎉 Application initialized successfully in ${duration}ms`);
        if (warnings.length > 0) {
          console.log('⚠️  Warnings:', warnings.join(', '));
        }
      } else {
        console.error(`❌ Application initialization failed in ${duration}ms`);
        console.error('Errors:', errors.join(', '));
      }

      return {
        success,
        services,
        warnings,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';

      console.error(`💥 Critical initialization failure in ${duration}ms:`, errorMessage);
      errors.push(errorMessage);

      return {
        success: false,
        services,
        warnings,
        errors,
        duration,
      };
    }
  }

  static getInitializationStatus(): {
    initialized: boolean;
    inProgress: boolean;
  } {
    return {
      initialized: this.isInitialized,
      inProgress: this.initPromise !== null && !this.isInitialized,
    };
  }

  static async checkStartupHealth(): Promise<{
    ready: boolean;
    message: string;
    services: Record<string, boolean>;
  }> {
    if (!this.isInitialized) {
      if (this.initPromise) {
        const result = await this.initPromise;
        return {
          ready: result.success,
          message: result.success ? 'Application ready' : 'Initialization failed',
          services: result.services,
        };
      }

      return {
        ready: false,
        message: 'Application not initialized',
        services: {},
      };
    }

    return {
      ready: true,
      message: 'Application ready',
      services: { database: true, cache: true, woocommerce: true },
    };
  }

  static reset(): void {
    this.isInitialized = false;
    this.initPromise = null;
    console.log('🔄 Application startup state reset');
  }
}

function isBuildPhase(): boolean {
  const phase = process.env.NEXT_PHASE?.trim().toLowerCase() ?? '';
  return phase === 'phase-production-build' || phase === 'phase-production-serverless';
}

export async function ensureInitialized(): Promise<void> {
  const result = await AppStartup.initialize();
  if (!result.success) {
    throw new Error(`Application initialization failed: ${result.errors.join(', ')}`);
  }
}

export function shouldRunStartupInit(): boolean {
  // Tenant data is initialized only inside a verified business context.
  if (process.env.TENANT_ENFORCEMENT === 'true') return false;
  if (typeof process === 'undefined') {
    return false;
  }

  const env = process.env.NODE_ENV ?? 'development';
  if (env === 'test' || process.env.VITEST === 'true' || process.env.SKIP_STARTUP_INIT === 'true') {
    return false;
  }

  if (process.env.SKIP_APP_STARTUP === 'true' || isBuildPhase()) {
    return false;
  }

  return true;
}

if (
  process.env.NODE_ENV === 'production' &&
  !process.env.RAILWAY_BUILD &&
  !process.env.DOCKER_BUILD &&
  process.env.CI !== 'true'
) {
  AppStartup.initialize().catch((error) => {
    console.error('Auto-initialization failed:', error);
  });
}

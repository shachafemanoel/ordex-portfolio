/**
 * Server-only Application Startup Service
 * This file must ONLY be imported from server components
 */

import 'server-only';

import { warmupCaches } from '@/lib/cache';
import { CircuitBreakerRegistry } from '@/lib/circuit-breaker';
import { healthMonitor } from '@/lib/health-monitor';
import { ensureDefaultAdminUser } from '@/lib/auth/default-admin';
import { ensureOrdersIndex } from '@/lib/data/ordersRedis';
import { ensureUserRoleEnumCompatibility } from '@/lib/db/user-role-compat';

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

export function shouldRunStartupInit(): boolean {
  // Skip during build phase to avoid connection issues
  if (typeof window !== 'undefined') {
    return false; // Never run in browser
  }

  // Skip during Next.js build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return false;
  }

  // Skip during Vercel build
  if (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development') {
    return false;
  }

  return true;
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
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Database check failed: ${message}`);
      console.error('Database initialization error:', error);
    }

    // 2. Default admin user
    if (services.database) {
      try {
        const compatibility = await ensureUserRoleEnumCompatibility();
        if (compatibility.repaired) {
          console.log(`🔄 ${compatibility.message}`);
        }

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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to ensure default admin user: ${message}`);
        console.error('Default admin setup failed:', error);
      }
    }

    // 3. Initialize cache
    try {
      console.log('💾 Warming up caches...');
      await warmupCaches();
      services.cache = true;
      const searchIndexReady = await ensureOrdersIndex();
      if (!searchIndexReady) {
        warnings.push('Redis search index unavailable, Redis-backed order search will fall back');
      }
      console.log('✅ Caches warmed up');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      warnings.push(`Cache warmup failed: ${message}`);
      console.warn('Cache warmup error:', error);
    }

    const duration = Date.now() - startTime;
    const success = errors.length === 0 && services.database;

    console.log(`✅ Initialization complete in ${duration}ms`);
    if (warnings.length > 0) {
      console.warn('⚠️ Warnings:', warnings);
    }
    if (errors.length > 0) {
      console.error('❌ Errors:', errors);
    }

    return { success, services, warnings, errors, duration };
  }
}

export async function ensureInitialized(): Promise<StartupResult> {
  return AppStartup.initialize();
}

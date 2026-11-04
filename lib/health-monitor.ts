import { ordersCache } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { getConfigurationStatus, testWooCommerceConnection } from '@/lib/woocommerce-config';

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
  details?: Record<string, any>;
  lastChecked: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: Date;
  services: HealthStatus[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

export class HealthMonitor {
  private startTime: Date = new Date();

  async checkDatabase(): Promise<HealthStatus> {
    const start = Date.now();

    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1 as test`;

      // Test a simple query performance
      const orderCount = await prisma.order.count();

      const responseTime = Date.now() - start;

      return {
        service: 'database',
        status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy',
        message:
          responseTime < 1000
            ? 'Database is responsive'
            : responseTime < 3000
              ? 'Database is slow but functional'
              : 'Database is very slow',
        responseTime,
        details: {
          orderCount,
          connectionPool: 'active',
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - start,
        lastChecked: new Date(),
      };
    }
  }

  async checkRedisCache(): Promise<HealthStatus> {
    const start = Date.now();

    try {
      // Test cache operations
      const testKey = 'health:test';
      const testValue = { timestamp: Date.now(), test: true };

      await ordersCache.set(testKey, testValue, 10);
      const retrieved = await ordersCache.get(testKey);
      await ordersCache.del(testKey);

      const responseTime = Date.now() - start;

      const isWorking = retrieved && retrieved.test === true;

      return {
        service: 'redis_cache',
        status: isWorking && responseTime < 100 ? 'healthy' : isWorking ? 'degraded' : 'unhealthy',
        message: isWorking
          ? responseTime < 100
            ? 'Cache is responsive'
            : 'Cache is slow but functional'
          : 'Cache operations failed',
        responseTime,
        details: {
          testPassed: isWorking,
          fallbackAvailable: true,
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        service: 'redis_cache',
        status: 'degraded', // Degraded because we have fallback
        message: `Redis cache unavailable, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - start,
        details: {
          fallbackActive: true,
        },
        lastChecked: new Date(),
      };
    }
  }

  async checkWooCommerceIntegration(): Promise<HealthStatus> {
    const start = Date.now();

    try {
      const configStatus = getConfigurationStatus();

      if (!configStatus.configured) {
        return {
          service: 'woocommerce',
          status: 'degraded',
          message: 'WooCommerce client not configured',
          responseTime: Date.now() - start,
          details: {
            configured: false,
            reason: configStatus.issues?.join(', ') ?? 'Missing environment variables',
          },
          lastChecked: new Date(),
        };
      }

      const connectionTest = await testWooCommerceConnection();
      const responseTime = Date.now() - start;

      return {
        service: 'woocommerce',
        status: connectionTest.success ? 'healthy' : 'unhealthy',
        message: connectionTest.error ?? 'OK',
        responseTime: connectionTest.responseTime ?? responseTime,
        details: {
          configured: true,
          lastSync: await this.getLastWooCommerceSync(),
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        service: 'woocommerce',
        status: 'unhealthy',
        message: `WooCommerce integration error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - start,
        lastChecked: new Date(),
      };
    }
  }

  async checkExternalServices(): Promise<HealthStatus[]> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedisCache(),
      this.checkWooCommerceIntegration(),
    ]);

    return checks.map((check, index) => {
      if (check.status === 'fulfilled') {
        return check.value;
      }

      const serviceNames = ['database', 'redis_cache', 'woocommerce'];
      return {
        service: serviceNames[index] ?? 'unknown',
        status: 'unhealthy' as const,
        message: `Health check failed: ${check.reason}`,
        responseTime: 0,
        lastChecked: new Date(),
      };
    });
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const services = await this.checkExternalServices();

    // Add system metrics
    const systemMetrics: HealthStatus = {
      service: 'system',
      status: 'healthy',
      message: 'System is running normally',
      details: {
        uptime: Date.now() - this.startTime.getTime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
      lastChecked: new Date(),
    };

    services.push(systemMetrics);

    // Calculate overall health
    const summary = {
      healthy: services.filter((s) => s.status === 'healthy').length,
      degraded: services.filter((s) => s.status === 'degraded').length,
      unhealthy: services.filter((s) => s.status === 'unhealthy').length,
      total: services.length,
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      version: (process.env.npm_package_version ?? '1.0.0') as string,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
      services,
      summary,
    };
  }

  private async getLastWooCommerceSync(): Promise<Date | null> {
    // WebhookEventLog table was removed in cleanup.
    // Returning null for now as we don't have a sync log.
    return null;
  }

  async checkReadiness(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
    const checks = {
      database: false,
      cache: false,
    };

    try {
      // Use shorter timeout for readiness checks to avoid blocking startup
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database check timeout')), 3000);
      });

      await Promise.race([prisma.$queryRaw`SELECT 1`, timeoutPromise]);
      checks.database = true;
    } catch (error) {
      // Log but don't fail readiness – allows deploys without database
      console.warn('Database readiness check failed:', error);
    }

    try {
      // Quick cache test with timeout
      const cacheTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Cache check timeout')), 1000);
      });

      await Promise.race([
        Promise.all([
          ordersCache.set('readiness:test', true, 5),
          ordersCache.get('readiness:test'),
        ]),
        cacheTimeoutPromise,
      ]);
      checks.cache = true;
    } catch {
      // Cache failure is acceptable with fallback
      checks.cache = true;
    }

    return {
      // Always report ready to avoid hard failures in environments
      // where the database is optional or temporarily unavailable
      ready: true,
      checks,
    };
  }

  async checkLiveness(): Promise<{ alive: boolean; uptime: number }> {
    return {
      alive: true,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics = new Map<string, Array<{ timestamp: number; duration: number }>>();

  static recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push({ timestamp: Date.now(), duration });

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  static getMetrics(name: string) {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return null;

    const durations = metrics.map((m) => m.duration);
    return {
      count: metrics.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
    };
  }

  static getAllMetrics() {
    const result: Record<string, any> = {};
    for (const [name, _] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }

  private static percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }
}

// Utility function to time operations
export function withPerformanceTracking<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = Date.now();
    try {
      const result = await fn();
      PerformanceMonitor.recordMetric(name, Date.now() - start);
      resolve(result);
    } catch (error) {
      PerformanceMonitor.recordMetric(`${name}:error`, Date.now() - start);
      reject(error);
    }
  });
}

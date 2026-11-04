/**
 * Database Monitoring and Performance Threshold System
 * Monitors database performance, connection health, and provides alerting
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/enhanced-logger';
import { isSimpleOmsMode } from '@/lib/simple-oms';

export interface DatabaseMetrics {
  connectionPool: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
    utilization: number;
  };
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    totalQueries: number;
    queriesPerSecond: number;
    p95QueryTime: number;
    p99QueryTime: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    lastError?: string;
    lastErrorTime?: Date;
  };
  storage: {
    totalSize?: number;
    freeSpace?: number;
    utilization?: number;
  };
  monitoring: {
    collectedAt: Date;
    monitoringDuration: number;
    sampleSize: number;
  };
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
  description: string;
}

export interface QueryPerformanceEntry {
  query: string;
  duration: number;
  timestamp: Date;
  error?: string;
  parameters?: any;
}

export interface AlertEvent {
  id: string;
  level: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
  resolved?: Date;
}

export class DatabaseMonitor {
  private queryMetrics: QueryPerformanceEntry[] = [];
  private connectionMetrics: { timestamp: Date; active: number; idle: number }[] = [];
  private alertHistory: AlertEvent[] = [];
  private lastHealthCheck?: Date;
  private isMonitoring = false;
  private monitoringInterval?: any;
  private cleanupInterval?: any;
  private consecutiveFailures = 0;
  private loopDetected = false;
  private readonly maxRailwayFailures = 5;

  // Performance thresholds
  private readonly thresholds: PerformanceThreshold[] = [
    {
      metric: 'averageQueryTime',
      warning: 1000, // 1 second
      critical: 3000, // 3 seconds
      unit: 'ms',
      description: 'Average query execution time',
    },
    {
      metric: 'connectionUtilization',
      warning: 80, // 80%
      critical: 95, // 95%
      unit: '%',
      description: 'Database connection pool utilization',
    },
    {
      metric: 'queriesPerSecond',
      warning: 100,
      critical: 500,
      unit: 'qps',
      description: 'Queries per second',
    },
    {
      metric: 'p95QueryTime',
      warning: 2000, // 2 seconds
      critical: 5000, // 5 seconds
      unit: 'ms',
      description: '95th percentile query time',
    },
    {
      metric: 'slowQueries',
      warning: 10,
      critical: 50,
      unit: 'count',
      description: 'Number of slow queries (>1s) in monitoring window',
    },
  ];

  constructor() {
    const phase = (process.env.NEXT_PHASE || '').toLowerCase();
    const isBuildPhase =
      phase === 'phase-production-build' ||
      phase === 'phase-production-serverless' ||
      process.env.RAILWAY_BUILD === 'true' ||
      process.env.DOCKER_BUILD === 'true';

    // Start monitoring automatically unless explicitly disabled (useful for tests/offline)
    const disabled =
      process.env.SKIP_DB_TESTS === '1' ||
      process.env.DATABASE_MONITOR_DISABLED === '1' ||
      isSimpleOmsMode() ||
      process.env.NODE_ENV === 'test' ||
      isBuildPhase;
    if (!disabled) {
      this.startMonitoring();
    } else {
      logger.info('Database monitoring skipped', {
        component: 'database-monitor',
        reason: 'disabled-by-env',
        env: process.env.NODE_ENV,
      });
    }

    // Cleanup old data periodically without keeping the process alive.
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // Every 5 minutes
    this.cleanupInterval.unref?.();
  }

  private logLoopEvent(params: {
    tag: string;
    path: string;
    method: string;
    status: string;
    requestId?: string;
    userId?: string | null;
    orderId?: string | null;
    attempt?: number;
  }): void {
    const payload = {
      tag: params.tag,
      path: params.path,
      method: params.method,
      status: params.status,
      requestId: params.requestId ?? randomUUID(),
      userId: params.userId ?? null,
      orderId: params.orderId ?? null,
      attempt: params.attempt,
      env: process.env.RAILWAY_ENVIRONMENT ?? 'unknown',
    };
    console.log(JSON.stringify(payload));
  }

  /**
   * Start database monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch((error) => {
        logger.error(
          'Database monitoring error',
          {
            component: 'database-monitor',
          },
          error as any
        );
      });
    }, intervalMs);
    this.monitoringInterval.unref?.();

    logger.info('Database monitoring started', {
      component: 'database-monitor',
      intervalMs,
    });
    this.logLoopEvent({
      tag: 'db-monitor',
      path: 'database-monitor.start',
      method: 'INTERVAL',
      status: 'started',
      attempt: 0,
    });
  }

  /**
   * Stop database monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;

    logger.info('Database monitoring stopped', {
      component: 'database-monitor',
    });
    this.logLoopEvent({
      tag: 'db-monitor',
      path: 'database-monitor.stop',
      method: 'INTERVAL',
      status: 'stopped',
      attempt: this.consecutiveFailures,
    });
  }

  /**
   * Record query performance
   */
  recordQuery(query: string, duration: number, error?: string, parameters?: any): void {
    const entry: QueryPerformanceEntry = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      error,
      parameters: this.sanitizeParameters(parameters),
    };

    this.queryMetrics.push(entry);

    // Log slow queries immediately
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        component: 'database-monitor',
        query: entry.query,
        duration,
        error,
      });
    }

    // Keep only recent metrics (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.queryMetrics = this.queryMetrics.filter((m) => m.timestamp > oneHourAgo);
  }

  /**
   * Collect comprehensive database metrics
   */
  async collectMetrics(): Promise<DatabaseMetrics> {
    const startTime = Date.now();
    const requestId = randomUUID();
    this.logLoopEvent({
      tag: 'db-monitor',
      path: 'database-monitor.collectMetrics',
      method: 'INTERVAL',
      status: 'start',
      requestId,
      attempt: this.consecutiveFailures + 1,
    });

    try {
      // Test basic connectivity and measure response time
      const connectivityStart = Date.now();
      try {
        await prisma.$queryRaw`SELECT 1 as test`;
      } catch (error: any) {
        // If it's a timeout (P2010), treat it as a performance issue, not a hard crash
        if (error?.code === 'P2010' || error?.message?.includes('timed out')) {
          throw new Error('Database heartbeat timed out (high load or connection pool exhaustion)');
        }
        throw error;
      }
      const connectivityTime = Date.now() - connectivityStart;

      // Get connection pool information (simplified - actual implementation depends on your setup)
      const connectionPool = await this.getConnectionPoolMetrics();

      // Calculate query performance metrics
      const performance = this.calculatePerformanceMetrics();

      // Determine health status
      const health = this.assessHealth(connectivityTime, performance, connectionPool);

      // Get storage information (if available)
      const storage = await this.getStorageMetrics();

      const metrics: DatabaseMetrics = {
        connectionPool,
        performance,
        health,
        storage,
        monitoring: {
          collectedAt: new Date(),
          monitoringDuration: Date.now() - startTime,
          sampleSize: this.queryMetrics.length,
        },
      };

      // Check thresholds and generate alerts
      this.checkThresholds(metrics);

      this.lastHealthCheck = new Date();
      this.consecutiveFailures = 0;
      this.logLoopEvent({
        tag: 'db-monitor',
        path: 'database-monitor.collectMetrics',
        method: 'INTERVAL',
        status: 'success',
        requestId,
        attempt: 0,
      });

      // logger.debug('Database metrics collected', {
      //   component: 'database-monitor',
      //   metrics: {
      //     connectionUtilization: connectionPool.utilization,
      //     averageQueryTime: performance.averageQueryTime,
      //     health: health.status,
      //   },
      // });

      return metrics;
    } catch (error) {
      this.consecutiveFailures += 1;
      this.logLoopEvent({
        tag: 'db-monitor',
        path: 'database-monitor.collectMetrics',
        method: 'INTERVAL',
        status: 'error',
        requestId,
        attempt: this.consecutiveFailures,
      });
      if (
        process.env.RAILWAY_ENVIRONMENT &&
        this.consecutiveFailures >= this.maxRailwayFailures &&
        !this.loopDetected
      ) {
        this.loopDetected = true;
        this.logLoopEvent({
          tag: 'db-monitor',
          path: 'database-monitor.collectMetrics',
          method: 'INTERVAL',
          status: 'loop_detected',
          requestId,
          attempt: this.consecutiveFailures,
        });
        this.stopMonitoring();
      }
      logger.error(
        'Failed to collect database metrics',
        {
          component: 'database-monitor',
        },
        error as any
      );

      // Return degraded status metrics
      return {
        connectionPool: {
          active: 0,
          idle: 0,
          total: 0,
          maxConnections: 10,
          utilization: 0,
        },
        performance: {
          averageQueryTime: 0,
          slowQueries: 0,
          totalQueries: 0,
          queriesPerSecond: 0,
          p95QueryTime: 0,
          p99QueryTime: 0,
        },
        health: {
          status: 'critical',
          uptime: 0,
          lastError: (error as any)?.message || 'Unknown error',
          lastErrorTime: new Date(),
        },
        storage: {},
        monitoring: {
          collectedAt: new Date(),
          monitoringDuration: Date.now() - startTime,
          sampleSize: 0,
        },
      };
    }
  }

  /**
   * Get connection pool metrics
   */
  private async getConnectionPoolMetrics(): Promise<DatabaseMetrics['connectionPool']> {
    try {
      // This is a simplified version. In a real implementation, you'd query
      // the actual connection pool metrics from your database driver or monitoring
      const maxConnections = parseInt(process.env.DB_POOL_MAX || '10');
      // const minConnections = parseInt(process.env.DB_POOL_MIN || '2'); // Reserved for pool configuration

      // Mock values - replace with actual connection pool queries
      const active = Math.min(5, maxConnections); // Active connections
      const idle = Math.max(0, maxConnections - active);
      const total = active + idle;
      const utilization = Math.round((active / maxConnections) * 100);

      return {
        active,
        idle,
        total,
        maxConnections,
        utilization,
      };
    } catch (error) {
      logger.warn(
        'Failed to get connection pool metrics',
        {
          component: 'database-monitor',
        },
        error as any
      );

      return {
        active: 0,
        idle: 0,
        total: 0,
        maxConnections: 10,
        utilization: 0,
      };
    }
  }

  /**
   * Calculate query performance metrics
   */
  private calculatePerformanceMetrics(): DatabaseMetrics['performance'] {
    if (this.queryMetrics.length === 0) {
      return {
        averageQueryTime: 0,
        slowQueries: 0,
        totalQueries: 0,
        queriesPerSecond: 0,
        p95QueryTime: 0,
        p99QueryTime: 0,
      };
    }

    const durations = this.queryMetrics.map((m) => m.duration).sort((a, b) => a - b);
    const totalQueries = this.queryMetrics.length;
    const slowQueries = this.queryMetrics.filter((m) => m.duration > 1000).length;
    const averageQueryTime = durations.reduce((a, b) => a + b, 0) / totalQueries;

    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const p95QueryTime = durations[p95Index] || 0;
    const p99QueryTime = durations[p99Index] || 0;

    // Calculate QPS based on recent metrics (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    const recentQueries = this.queryMetrics.filter((m) => m.timestamp > fiveMinutesAgo);
    const queriesPerSecond = recentQueries.length / 300; // 300 seconds in 5 minutes

    return {
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      slowQueries,
      totalQueries,
      queriesPerSecond: Math.round(queriesPerSecond * 100) / 100,
      p95QueryTime: Math.round(p95QueryTime * 100) / 100,
      p99QueryTime: Math.round(p99QueryTime * 100) / 100,
    };
  }

  /**
   * Assess overall database health
   */
  private assessHealth(
    connectivityTime: number,
    performance: DatabaseMetrics['performance'],
    connectionPool: DatabaseMetrics['connectionPool']
  ): DatabaseMetrics['health'] {
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Critical conditions
    if (
      connectivityTime > 5000 || // 5 second connectivity
      performance.averageQueryTime > 3000 || // 3 second average
      connectionPool.utilization > 95 // 95% connection utilization
    ) {
      status = 'critical';
    }
    // Degraded conditions
    else if (
      connectivityTime > 1000 || // 1 second connectivity
      performance.averageQueryTime > 1000 || // 1 second average
      connectionPool.utilization > 80 || // 80% connection utilization
      performance.slowQueries > 10 // More than 10 slow queries
    ) {
      status = 'degraded';
    }

    const uptime = this.lastHealthCheck ? Date.now() - this.lastHealthCheck.getTime() : 0;

    return {
      status,
      uptime: Math.floor(uptime / 1000), // Convert to seconds
    };
  }

  /**
   * Get database storage metrics
   */
  private async getStorageMetrics(): Promise<DatabaseMetrics['storage']> {
    try {
      // This would typically query the database for storage information
      // Implementation varies by database type (PostgreSQL, MySQL, etc.)

      // For PostgreSQL, you might use:
      // SELECT pg_database_size(current_database()) as size;
      // SELECT pg_size_pretty(pg_database_size(current_database()));

      // This is a placeholder implementation
      return {
        totalSize: undefined, // Would be actual database size in bytes
        freeSpace: undefined, // Would be available space
        utilization: undefined, // Would be usage percentage
      };
    } catch (error) {
      logger.warn(
        'Failed to get storage metrics',
        {
          component: 'database-monitor',
        },
        error as any
      );
      return {};
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(metrics: DatabaseMetrics): void {
    const checks = [
      { metric: 'averageQueryTime', value: metrics.performance.averageQueryTime },
      { metric: 'connectionUtilization', value: metrics.connectionPool.utilization },
      { metric: 'queriesPerSecond', value: metrics.performance.queriesPerSecond },
      { metric: 'p95QueryTime', value: metrics.performance.p95QueryTime },
      { metric: 'slowQueries', value: metrics.performance.slowQueries },
    ];

    for (const check of checks) {
      const threshold = this.thresholds.find((t) => t.metric === check.metric);
      if (!threshold) continue;

      const existingAlert = this.alertHistory.find((a) => a.metric === check.metric && !a.resolved);

      // Check if threshold is exceeded
      if (check.value >= threshold.critical) {
        if (!existingAlert || existingAlert.level !== 'critical') {
          this.createAlert('critical', threshold, check.value);
        }
      } else if (check.value >= threshold.warning) {
        if (!existingAlert || existingAlert.level !== 'warning') {
          this.createAlert('warning', threshold, check.value);
        }
      } else if (existingAlert) {
        // Value is back to normal, resolve alert
        this.resolveAlert(existingAlert);
      }
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(
    level: 'warning' | 'critical',
    threshold: PerformanceThreshold,
    value: number
  ): void {
    const alert: AlertEvent = {
      id: crypto.randomUUID(),
      level,
      metric: threshold.metric,
      value,
      threshold: level === 'critical' ? threshold.critical : threshold.warning,
      message: `${threshold.description} is ${value}${threshold.unit}, exceeding ${level} threshold of ${level === 'critical' ? threshold.critical : threshold.warning}${threshold.unit}`,
      timestamp: new Date(),
    };

    this.alertHistory.push(alert);

    // Log alert
    const logLevel = level === 'critical' ? 'error' : 'warn';
    logger[logLevel](`Database ${level} alert: ${alert.message}`, {
      component: 'database-monitor',
      alert: true,
      level,
      metric: threshold.metric,
      value,
      threshold: alert.threshold,
    });

    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 86400000);
    this.alertHistory = this.alertHistory.filter((a) => a.timestamp > oneDayAgo);
  }

  /**
   * Resolve an existing alert
   */
  private resolveAlert(alert: AlertEvent): void {
    alert.resolved = new Date();

    logger.info(`Database alert resolved: ${alert.message}`, {
      component: 'database-monitor',
      alert: true,
      level: alert.level,
      metric: alert.metric,
      duration: alert.resolved.getTime() - alert.timestamp.getTime(),
    });
  }

  /**
   * Get current alerts
   */
  getActiveAlerts(): AlertEvent[] {
    return this.alertHistory.filter((a) => !a.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): AlertEvent[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get performance thresholds
   */
  getThresholds(): PerformanceThreshold[] {
    return [...this.thresholds];
  }

  /**
   * Update performance threshold
   */
  updateThreshold(metric: string, warning: number, critical: number): boolean {
    const threshold = this.thresholds.find((t) => t.metric === metric);
    if (!threshold) return false;

    threshold.warning = warning;
    threshold.critical = critical;

    logger.info(`Updated performance threshold for ${metric}`, {
      component: 'database-monitor',
      metric,
      warning,
      critical,
    });

    return true;
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove potential sensitive data from queries
    return query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, 'password=***')
      .replace(/email\s*=\s*['"][^'"]*['"]/gi, 'email=***')
      .replace(/token\s*=\s*['"][^'"]*['"]/gi, 'token=***')
      .substring(0, 200); // Limit query length
  }

  /**
   * Sanitize parameters for logging
   */
  private sanitizeParameters(parameters: any): any {
    if (!parameters) return undefined;

    const sanitized = { ...parameters };
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '***';
      }
    });

    return sanitized;
  }

  /**
   * Clean up old data
   */
  private cleanup(): void {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    // Clean old query metrics (keep last hour)
    const beforeCount = this.queryMetrics.length;
    this.queryMetrics = this.queryMetrics.filter((m) => m.timestamp > oneHourAgo);

    // Clean old connection metrics
    this.connectionMetrics = this.connectionMetrics.filter((m) => m.timestamp > oneHourAgo);

    // Clean old alerts (keep last day)
    this.alertHistory = this.alertHistory.filter((a) => a.timestamp > oneDayAgo);

    const afterCount = this.queryMetrics.length;
    if (beforeCount > afterCount) {
      logger.debug(
        `Database monitor cleanup: removed ${beforeCount - afterCount} old query metrics`,
        {
          component: 'database-monitor',
        }
      );
    }
  }
}

// Singleton instance
// Singleton instance handling for Next.js HMR
const globalForMonitor = global as unknown as { databaseMonitor: DatabaseMonitor };

export const databaseMonitor = globalForMonitor.databaseMonitor || new DatabaseMonitor();

if (process.env.NODE_ENV !== 'production') globalForMonitor.databaseMonitor = databaseMonitor;

/**
 * Decorator for monitoring database query performance
 */
export function monitorQuery<T extends (...args: any[]) => Promise<any>>(
  queryName: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;

      databaseMonitor.recordQuery(queryName, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      databaseMonitor.recordQuery(queryName, duration, errorMessage);
      throw error;
    }
  }) as T;
}

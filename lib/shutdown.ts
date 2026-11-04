import { dashboardCache, integrationCache, ordersCache, reportsCache } from '@/lib/cache';
import { logger } from '@/lib/enhanced-logger';

let isShuttingDown = false;

declare global {
  var __ordexShutdownHandlersRegistered: boolean | undefined;
}

function isBuildPhase() {
  const phase = (process.env.NEXT_PHASE || '').toLowerCase();

  return (
    phase === 'phase-production-build' ||
    phase === 'phase-production-serverless' ||
    process.env.RAILWAY_BUILD === 'true' ||
    process.env.DOCKER_BUILD === 'true'
  );
}

export async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`, { component: 'shutdown' });

  // 1. Dispose caches to clear timers/intervals
  ordersCache.dispose();
  reportsCache.dispose();
  dashboardCache.dispose();
  integrationCache.dispose();

  const [{ databaseMonitor }, { webhookQueue }] = await Promise.all([
    import('@/lib/database-monitor'),
    import('@/lib/webhook-reliability'),
  ]);

  // 2. Dispose webhook queue
  webhookQueue.dispose();

  // 3. Stop database monitor
  databaseMonitor.stopMonitoring();

  logger.info('Cleanup complete. Exiting process.', { component: 'shutdown' });

  // Allow the process to exit naturally or force it if it hangs
  setTimeout(() => {
    console.error('Force exiting after timeout...');
    process.exit(1);
  }, 5000).unref();
}

// Register handlers
if (
  typeof process !== 'undefined' &&
  !isBuildPhase() &&
  !globalThis.__ordexShutdownHandlersRegistered
) {
  globalThis.__ordexShutdownHandlersRegistered = true;

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT');
    process.exit(0);
  });
}

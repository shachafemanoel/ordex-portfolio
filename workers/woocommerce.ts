import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { closeDatabaseConnection } from '../lib/db';
import { runWorkerCycle } from '../lib/integrations/woocommerce/jobs';

const workerId = `woo-${randomUUID()}`;
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});

async function main() {
  if (process.env.TENANT_ENFORCEMENT !== 'true')
    throw new Error('Woo worker requires tenant enforcement');
  while (!stopping) {
    try {
      const processed = await runWorkerCycle(workerId);
      if (!processed && !stopping) await setTimeout(1000);
    } catch {
      console.error(JSON.stringify({ event: 'woo.worker_cycle_failed', workerId }));
      if (!stopping) await setTimeout(5000);
    }
  }
}
main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => closeDatabaseConnection());

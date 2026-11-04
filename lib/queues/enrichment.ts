import { Queue, type QueueOptions } from 'bullmq';

let enrichmentQueue: Queue | null = null;

function getQueue(): Queue | null {
  if (enrichmentQueue !== null) return enrichmentQueue;

  const url = process.env.REDIS_URL;
  if (!url) {
    // No Redis configured; operate in no-op mode to avoid connection spam
    enrichmentQueue = null;
    return null;
  }

  try {
    const parsed = new URL(url);
    const opts: QueueOptions = {
      connection: {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        tls: parsed.protocol === 'rediss:' ? {} : undefined,
      } as any,
    };
    enrichmentQueue = new Queue('order-enrichment', opts);
  } catch (e) {
    console.warn('Enrichment queue disabled: invalid REDIS_URL', { error: (e as Error).message });
    enrichmentQueue = null;
  }

  return enrichmentQueue;
}

export async function enqueueEnrichment(orderId: string, sourceOrderId: string) {
  const queue = getQueue();
  if (!queue) return false;
  try {
    await queue.add(
      'enrich',
      { orderId, sourceOrderId },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: 200,
        removeOnFail: false,
      }
    );
    return true;
  } catch (e) {
    console.warn('Failed to enqueue enrichment job', { orderId, sourceOrderId, error: (e as Error).message });
    return false;
  }
}

import { prisma, withIdentityDatabase } from '@/lib/db';
import { requireTenantId, withTenantContext } from '@/lib/tenancy/context';
import type { Prisma, WooIntegration, WooSyncJob } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { openCredentials } from './credentials';
import { applyImportPage, PagePayload, readStorePage, settleImports } from './import';
import { processOrder, processProduct } from './processor';
import { normalizeStoreUrl } from './store-address';
import { StoreError, storeRequest } from './store-client';
import { IntakeError } from './transform';

export const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000];
export const LEASE_MS = 60_000;
export const MAX_ATTEMPTS = 5;

export function failureState(error: unknown, attempts: number) {
  const code =
    error instanceof IntakeError || error instanceof StoreError ? error.code : 'PROCESSING_ERROR';
  const permanent =
    error instanceof IntakeError ||
    (error instanceof StoreError && !['UNREACHABLE'].includes(error.code));
  return {
    code,
    state: permanent ? 'NEEDS_ATTENTION' : attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
    delay: RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)],
  };
}

export function inStore<T>(integration: WooIntegration, action: () => Promise<T>) {
  if (!integration.serviceUserId) throw new IntakeError('MISSING_SERVICE_USER');
  return withTenantContext(
    { tenantId: integration.tenantId, userId: integration.serviceUserId, role: 'OPERATIONS' },
    action
  );
}

export async function claimJob(
  integrationId: string,
  workerId: string
): Promise<WooSyncJob | null> {
  // Exhausted leases need a final state even if the fifth attempt died before reporting a result.
  await prisma.$executeRaw`UPDATE woo_sync_jobs SET state='FAILED', locked_by=NULL, locked_until=NULL, last_error_code='LEASE_EXHAUSTED'
    WHERE integration_id=${integrationId}::uuid AND state='RUNNING' AND locked_until < now() AND attempts >= ${MAX_ATTEMPTS}`;
  const token = randomUUID();
  const jobs = await prisma.$queryRaw<WooSyncJob[]>`
    UPDATE woo_sync_jobs SET state='RUNNING', attempts=attempts+1, locked_by=${token}::uuid,
      locked_until=now()+interval '60 seconds'
    WHERE id=(SELECT id FROM woo_sync_jobs WHERE integration_id=${integrationId}::uuid
      AND attempts < ${MAX_ATTEMPTS} AND ((state='PENDING' AND available_at<=now()) OR (state='RUNNING' AND locked_until<now()))
      ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, tenant_id AS "tenantId", integration_id AS "integrationId", kind, object_id AS "objectId",
      attempts, locked_by AS "lockedBy", parent_id AS "parentId", payload, progress, dedup_key AS "dedupKey", state`;
  await prisma.workerHeartbeat.upsert({
    where: { tenantId_workerId: { tenantId: await requireTenantId(), workerId } },
    create: { workerId },
    update: { lastSeenAt: new Date() },
  });
  return jobs[0] ?? null;
}

export async function enqueue(
  tx: Prisma.TransactionClient,
  integrationId: string,
  kind: string,
  objectId: string,
  version: string,
  payload: Prisma.InputJsonValue,
  parentId?: string
) {
  await tx.$executeRaw`INSERT INTO woo_sync_jobs (id,integration_id,kind,object_id,dedup_key,payload,parent_id)
    VALUES (gen_random_uuid(),${integrationId}::uuid,${kind},${objectId},${kind + ':' + objectId + ':' + version},${JSON.stringify(payload)}::jsonb,${parentId ?? null}::uuid)
    ON CONFLICT (tenant_id,integration_id,dedup_key) DO NOTHING`;
}

export async function processClaim(integration: WooIntegration, job: WooSyncJob) {
  try {
    const credentials = openCredentials(integration.credentials);
    if (!credentials || !integration.enabled) throw new IntakeError('CONNECTION_DISABLED');
    let payload: unknown = job.payload;
    // Read authoritative store state; never write an order to WooCommerce.
    if (job.kind === 'ORDER_EVENT') {
      if (!/^\d+$/.test(job.objectId ?? '')) throw new IntakeError('INVALID_OBJECT_ID');
      payload = await storeRequest(
        normalizeStoreUrl(integration.baseUrl),
        credentials,
        'GET',
        `orders/${job.objectId}`
      );
    }
    if (job.kind === 'IMPORT_PAGE')
      payload = await readStorePage(integration, PagePayload.parse(job.payload), true);
    await prisma.$transaction(
      async (tx) => {
        const owned = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM woo_sync_jobs WHERE id=${job.id}::uuid
        AND state='RUNNING' AND locked_by=${job.lockedBy}::uuid AND locked_until>now() FOR UPDATE`;
        if (!owned.length) return; // The lease expired or another worker recovered it.
        const live = await tx.wooIntegration.findUniqueOrThrow({ where: { id: integration.id } });
        if (!live.enabled || live.baseUrl !== integration.baseUrl)
          throw new IntakeError('CONNECTION_DISABLED');
        await tx.$queryRaw`SELECT set_config('app.woo_sync','1',true)`;
        if (job.kind === 'ORDER_EVENT' || job.kind === 'ORDER_IMPORT')
          await processOrder(tx, live, payload);
        else if (job.kind === 'PRODUCT_IMPORT') await processProduct(tx, live, payload);
        else if (job.kind === 'IMPORT_PAGE')
          await applyImportPage(tx, live, job, payload as Record<string, unknown>[]);
        else throw new IntakeError('UNKNOWN_JOB_KIND');
        await tx.wooSyncJob.update({
          where: { id: job.id },
          data: {
            state: 'SUCCEEDED',
            lockedUntil: null,
            lockedBy: null,
            completedAt: new Date(),
            lastErrorCode: null,
          },
        });
        await tx.wooIntegration.update({
          where: { id: live.id },
          data: { lastSyncAt: new Date() },
        });
      },
      { timeout: 20_000 }
    );
  } catch (error) {
    const failure = failureState(error, job.attempts);
    await prisma.wooSyncJob.updateMany({
      where: { id: job.id, state: 'RUNNING', lockedBy: job.lockedBy },
      data: {
        state: failure.state,
        lastErrorCode: failure.code,
        lockedUntil: null,
        lockedBy: null,
        availableAt: new Date(Date.now() + failure.delay),
      },
    });
  }
}

/** Only this trusted worker enumerates businesses. All claims and writes then run under RLS. */
export async function runWorkerCycle(workerId: string) {
  const integrations = await withIdentityDatabase((db) =>
    db.wooIntegration.findMany({ where: { enabled: true, serviceUserId: { not: null } } })
  );
  let processed = 0;
  for (const integration of integrations)
    await inStore(integration, async () => {
      const job = await claimJob(integration.id, workerId);
      if (job) {
        await processClaim(integration, job);
        processed += 1;
      }
      await settleImports();
    });
  return processed;
}

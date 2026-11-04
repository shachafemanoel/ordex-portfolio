import { ApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenancy/context';
import type { Prisma, WooIntegration, WooSyncJob } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { openCredentials } from './credentials';
import { normalizeStoreUrl } from './store-address';
import { StoreError, storeRequest } from './store-client';
import { IntakeError } from './transform';

export const PAGE_SIZE = 50;
export const OPEN_STATUSES = ['pending', 'on-hold', 'processing'];
export const PreviewInput = z.object({
  resource: z.enum(['products', 'orders']),
  page: z.number().int().min(1).max(10000).default(1),
});
export const ImportInput = z.object({ previewId: z.string().uuid(), confirm: z.literal(true) });
export const PagePayload = z.object({
  resource: z.enum(['products', 'orders', 'variations']),
  page: z.number().int().positive(),
  productId: z.number().int().positive().optional(),
});

export async function requireStoreAdmin() {
  const context = await requireTenantContext();
  if (context.role !== 'ADMIN')
    throw new ApiError('FORBIDDEN', 'רק מנהל העסק יכול לנהל סנכרון', 403);
  return context;
}
export async function connectedStore() {
  await requireStoreAdmin();
  const integration = await prisma.wooIntegration.findFirst();
  if (!integration?.enabled || !openCredentials(integration.credentials))
    throw new ApiError('NOT_CONNECTED', 'יש לחבר חנות תחילה', 409);
  return integration;
}

export async function readStorePage(
  integration: WooIntegration,
  input: z.infer<typeof PagePayload>,
  openOnly: boolean
) {
  const credentials = openCredentials(integration.credentials);
  if (!credentials) throw new StoreError('UNAUTHORIZED');
  const query = new URLSearchParams({
    per_page: String(PAGE_SIZE),
    page: String(input.page),
    orderby: 'id',
    order: 'asc',
  });
  if (input.resource === 'orders' && openOnly) query.set('status', OPEN_STATUSES.join(','));
  const resource =
    input.resource === 'variations' ? `products/${input.productId}/variations` : input.resource;
  const rows = await storeRequest<unknown>(
    normalizeStoreUrl(integration.baseUrl),
    credentials,
    'GET',
    `${resource}?${query}`
  );
  const parsed = z
    .array(z.object({ id: z.number().int().positive() }).passthrough())
    .max(PAGE_SIZE)
    .safeParse(rows);
  if (!parsed.success) throw new StoreError('BAD_RESPONSE');
  return parsed.data;
}

export async function previewImport(input: z.infer<typeof PreviewInput>) {
  const integration = await connectedStore();
  const rows = await readStorePage(integration, input, false);
  const preview = await prisma.wooSyncJob.create({
    data: {
      integrationId: integration.id,
      kind: 'PREVIEW',
      dedupKey: `preview:${randomUUID()}`,
      state: 'SUCCEEDED',
      completedAt: new Date(),
      progress: { resource: input.resource, page: input.page },
      payload: { storeUrl: integration.baseUrl },
    },
  });
  const items = rows.map((row) => ({
    id: row.id,
    label: String(row.name ?? row.number ?? row.id),
    sku: typeof row.sku === 'string' ? row.sku : null,
    status: typeof row.status === 'string' ? row.status : null,
    total: typeof row.total === 'string' ? row.total : null,
    eligible: input.resource === 'products' || OPEN_STATUSES.includes(String(row.status)),
    review:
      input.resource === 'orders' &&
      ![...OPEN_STATUSES, 'completed', 'cancelled', 'refunded', 'failed', 'trash'].includes(
        String(row.status)
      )
        ? 'UNKNOWN_STORE_STATUS'
        : null,
  }));
  return {
    previewId: preview.id,
    resource: input.resource,
    page: input.page,
    hasNext: rows.length === PAGE_SIZE,
    items,
  };
}

export async function approveImport(previewId: string) {
  const context = await requireStoreAdmin();
  const integration = await connectedStore();
  return prisma.$transaction(async (tx) => {
    const preview = await tx.wooSyncJob.findFirst({
      where: {
        id: previewId,
        integrationId: integration.id,
        kind: 'PREVIEW',
        state: 'SUCCEEDED',
        createdAt: { gte: new Date(Date.now() - 15 * 60_000) },
      },
    });
    if (!preview || (preview.payload as { storeUrl?: string })?.storeUrl !== integration.baseUrl)
      throw new ApiError('PREVIEW_EXPIRED', 'יש לרענן את התצוגה המקדימה לפני אישור ייבוא', 409);
    const root = await tx.wooSyncJob.upsert({
      where: {
        tenantId_integrationId_dedupKey: {
          tenantId: context.tenantId,
          integrationId: integration.id,
          dedupKey: `import:${preview.id}`,
        },
      },
      create: {
        integrationId: integration.id,
        kind: 'IMPORT',
        dedupKey: `import:${preview.id}`,
        state: 'IMPORTING',
        progress: { approvedBy: context.userId, previewId: preview.id },
      },
      update: {},
    });
    await enqueuePage(tx, integration.id, root.id, { resource: 'products', page: 1 });
    return { jobId: root.id };
  });
}

export async function enqueuePage(
  tx: Prisma.TransactionClient,
  integrationId: string,
  parentId: string,
  input: z.infer<typeof PagePayload>
) {
  const key = `page:${parentId}:${input.resource}:${input.productId ?? ''}:${input.page}`;
  await tx.$executeRaw`INSERT INTO woo_sync_jobs(id,integration_id,kind,dedup_key,parent_id,payload)
    VALUES(gen_random_uuid(),${integrationId}::uuid,'IMPORT_PAGE',${key},${parentId}::uuid,${JSON.stringify(input)}::jsonb)
    ON CONFLICT(tenant_id,integration_id,dedup_key) DO NOTHING`;
}

export async function applyImportPage(
  tx: Prisma.TransactionClient,
  integration: WooIntegration,
  job: WooSyncJob,
  rows: Record<string, unknown>[]
) {
  const input = PagePayload.parse(job.payload);
  if (!job.parentId) throw new IntakeError('MISSING_IMPORT_PARENT');
  for (const row of rows) {
    // An event arriving during import uses the same source version check in processOrder.
    if (input.resource === 'orders' && !OPEN_STATUSES.includes(String(row.status)))
      throw new IntakeError('UNEXPECTED_IMPORT_STATUS');
    const kind = input.resource === 'orders' ? 'ORDER_IMPORT' : 'PRODUCT_IMPORT';
    const version = String(row.date_modified_gmt ?? 'missing');
    const payload = input.resource === 'variations' ? { ...row, type: 'variation' } : row;
    await tx.$executeRaw`INSERT INTO woo_sync_jobs(id,integration_id,kind,object_id,dedup_key,parent_id,payload)
      VALUES(gen_random_uuid(),${integration.id}::uuid,${kind},${String(row.id)},${`${kind}:${row.id}:${version}`},${job.parentId}::uuid,${JSON.stringify(payload)}::jsonb)
      ON CONFLICT(tenant_id,integration_id,dedup_key) DO NOTHING`;
    if (input.resource === 'products' && row.type === 'variable')
      await enqueuePage(tx, integration.id, job.parentId, {
        resource: 'variations',
        page: 1,
        productId: Number(row.id),
      });
  }
  if (rows.length === PAGE_SIZE)
    await enqueuePage(tx, integration.id, job.parentId, { ...input, page: input.page + 1 });
  else if (input.resource === 'products')
    await enqueuePage(tx, integration.id, job.parentId, { resource: 'orders', page: 1 });
}

export async function settleImports() {
  const roots = await prisma.wooSyncJob.findMany({
    where: { kind: 'IMPORT', state: { in: ['IMPORTING', 'PARTIAL_FAILURE'] } },
  });
  for (const root of roots) {
    const counts = await prisma.wooSyncJob.groupBy({
      by: ['state'],
      where: { parentId: root.id },
      _count: true,
    });
    const pending = counts
      .filter((c) => ['PENDING', 'RUNNING'].includes(c.state))
      .reduce((s, c) => s + c._count, 0);
    const failures = counts
      .filter((c) => ['FAILED', 'NEEDS_ATTENTION'].includes(c.state))
      .reduce((s, c) => s + c._count, 0);
    const succeeded = counts
      .filter((c) => c.state === 'SUCCEEDED')
      .reduce((s, c) => s + c._count, 0);
    if (!pending && counts.length)
      await prisma.wooSyncJob.update({
        where: { id: root.id },
        data: {
          state: failures ? 'PARTIAL_FAILURE' : 'SUCCEEDED',
          completedAt: new Date(),
          progress: { ...(root.progress as Prisma.JsonObject), succeeded, failed: failures },
        },
      });
  }
}

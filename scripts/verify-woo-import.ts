import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../lib/db';
import { withTenantContext } from '../lib/tenancy/context';
import { sealCredentials } from '../lib/integrations/woocommerce/credentials';
import { approveImport, previewImport } from '../lib/integrations/woocommerce/import';
import { listJobs, retryJob } from '../lib/integrations/woocommerce/operations';
import { runWorkerCycle, enqueue } from '../lib/integrations/woocommerce/jobs';
import { startMockStore, wooOrder } from '../tests/support/wooMockStore';

async function main() {
 const url=new URL(process.env.DATABASE_URL||'');
 assert(['localhost','127.0.0.1'].includes(url.hostname) && /^retzef_.*test/.test(url.pathname.slice(1)));
 assert.equal(process.env.TENANT_ENFORCEMENT,'true');
 const stores=await Promise.all([startMockStore(),startMockStore()]);
 try {
  const businesses=[];
  for(const [i,store] of stores.entries()) {
   const tenantId=`import-${randomUUID()}`,userId=randomUUID();
   await withIdentityDatabase(async db=>{
    await db.tenant.create({data:{id:tenantId,name:`Synthetic import ${i}`}});
    await db.user.create({data:{id:userId,name:'Synthetic admin',email:`${userId}@example.invalid`,role:'ADMIN'}});
    await db.tenantMembership.create({data:{tenantId,userId,role:'ADMIN'}});
   });
   const integration=await withTenantContext({tenantId,userId,role:'ADMIN'},()=>prisma.wooIntegration.create({data:{baseUrl:store.url,credentials:sealCredentials({...store.keys,webhookSecret:'synthetic'}),serviceUserId:userId}}));
   businesses.push({tenantId,userId,integration});
   store.products.set(10,{id:10,name:'ספה',sku:'SAME-SKU',type:'simple',price:'450.00',date_modified_gmt:'2026-10-29T08:00:00',stock_quantity:5,stock_status:'instock'});
   store.orders.set(501,wooOrder(501));
   store.orders.set(502,wooOrder(502,{status:'completed'}));
   store.orders.set(503,wooOrder(503,{status:'custom-status'}));
  }
  const [a,b]=businesses;
  const run=<T>(who:typeof a,action:()=>Promise<T>,role:'ADMIN'|'OPERATIONS'='ADMIN')=>withTenantContext({tenantId:who.tenantId,userId:who.userId,role},action);
  await assert.rejects(run(a,()=>previewImport({resource:'products',page:1}),'OPERATIONS'),/מנהל/);
  const preview=await run(a,()=>previewImport({resource:'orders',page:1}));
  assert(preview.items.some(i=>i.review==='UNKNOWN_STORE_STATUS'));
  assert.equal(preview.items.find(i=>i.id===502)!.eligible,false);
  const root=await run(a,()=>approveImport(preview.previewId));
  assert.equal((await run(a,()=>approveImport(preview.previewId))).jobId,root.jobId,'idempotent approval');
  await assert.rejects(run(b,()=>approveImport(preview.previewId)),/תצוגה/);
  const previewB=await run(b,()=>previewImport({resource:'products',page:1}));
  await run(b,()=>approveImport(previewB.previewId));
  await run(a,()=>prisma.$transaction(tx=>enqueue(tx,a.integration.id,'ORDER_EVENT','501','live',wooOrder(501))));
  // Worker drains all synthetic integrations; prior scripts may have intentionally failed jobs.
  for(let i=0;i<30;i++) await runWorkerCycle('import-verification');
  assert.equal(await run(a,()=>prisma.order.count()),1);
  assert.equal(await run(b,()=>prisma.order.count()),1);
  assert.equal(await run(a,()=>prisma.product.count({where:{sku:'SAME-SKU'}})),1);
  assert.equal(await run(b,()=>prisma.product.count({where:{sku:'SAME-SKU'}})),1);
  assert.equal((await run(a,()=>prisma.wooSyncJob.findUniqueOrThrow({where:{id:root.jobId}}))).state,'SUCCEEDED');
  const repeated=await run(a,()=>previewImport({resource:'products',page:1}));await run(a,()=>approveImport(repeated.previewId));
  for(let i=0;i<8;i++) await runWorkerCycle('import-verification');
  assert.equal(await run(a,()=>prisma.order.count()),1);assert.equal(await run(a,()=>prisma.product.count()),1);
  const ops=await run(a,()=>listJobs());assert.equal(ops.workerStale,false);
  const ownId=ops.jobs[0].id;
  await assert.rejects(run(b,()=>retryJob(ownId)),/לא נמצאה/);
  await assert.rejects(run(a,()=>retryJob(ownId),'OPERATIONS'),/מנהל/);
  const failed=await run(a,()=>prisma.wooSyncJob.create({data:{integrationId:a.integration.id,kind:'ORDER_EVENT',dedupKey:`retry-${randomUUID()}`,state:'NEEDS_ATTENTION',attempts:1,objectId:'501'}}));
  await run(a,()=>retryJob(failed.id));
  assert.equal((await run(a,()=>prisma.wooSyncJob.findUniqueOrThrow({where:{id:failed.id}}))).attempts,1);
  assert.equal((await run(a,()=>prisma.wooSyncJob.findUniqueOrThrow({where:{id:failed.id}}))).state,'PENDING');
  await run(a,()=>prisma.wooSyncJob.update({where:{id:failed.id},data:{state:'FAILED',attempts:5}}));
  await assert.rejects(run(a,()=>retryJob(failed.id)),/מוצו/);
  assert(!(JSON.stringify(ops).includes('consumerSecret')));assert(!(JSON.stringify(ops).includes('0521234567')));
  console.log(JSON.stringify({passed:true,checks:['admin-only preview','unknown status review','closed history excluded','approval idempotency','foreign preview blocked','import/event overlap','same IDs and SKU across businesses','repeat import','worker monitoring','foreign retry blocked','staff retry blocked','audited bounded manual retry','source payloads absent from jobs API']}));
 } finally {await Promise.all(stores.map(s=>s.close()));}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>closeDatabaseConnection());

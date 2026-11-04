import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../lib/db';
import { withTenantContext } from '../lib/tenancy/context';

async function main() {
  const url=new URL(process.env.DATABASE_URL || '');
  assert(['localhost','127.0.0.1'].includes(url.hostname) && /^retzef_.*test/.test(url.pathname.slice(1)));
  assert.equal(process.env.TENANT_ENFORCEMENT,'true');
  const tenantId=`payments-${randomUUID()}`, userId=randomUUID();
  await withIdentityDatabase(async db=>{
    await db.tenant.create({data:{id:tenantId,name:'Synthetic payments'}});
    await db.user.create({data:{id:userId,email:`${userId}@example.invalid`,name:'Operator',role:'OPERATIONS'}});
    await db.tenantMembership.create({data:{tenantId,userId,role:'OPERATIONS'}});
  });
  const run=<T>(role:'ADMIN'|'OPERATIONS',action:()=>Promise<T>)=>withTenantContext({tenantId,userId,role},action);
  const order=await run('OPERATIONS',async()=>{
    const customer=await prisma.customer.create({data:{name:'דנה'}});
    const address=await prisma.address.create({data:{customerId:customer.id,type:'SHIPPING',city:'חיפה',street:'הרצל',number:'5'}});
    return prisma.order.create({data:{number:'PAY-1',customerId:customer.id,billingAddressId:address.id,shippingAddressId:address.id,currency:'ILS',totalCents:10000,status:'READY'}});
  });
  const depart=(target:'IN_TRANSIT'|'INSTALLATION',role:'ADMIN'|'OPERATIONS'='OPERATIONS',reason?:string)=>run(role,()=>prisma.$transaction(async tx=>{
    if(reason) await tx.$queryRaw`SELECT set_config('app.transition_override_reason',${reason},true)`;
    await tx.order.update({where:{id:order.id},data:{status:target}});
    await tx.statusHistory.create({data:{orderId:order.id,fromStatus:'READY',toStatus:target,changedBy:userId,reason,metadata:{manualOverride:Boolean(reason)}}});
  }));
  await assert.rejects(depart('IN_TRANSIT'),/Full payment/);
  await assert.rejects(depart('INSTALLATION','OPERATIONS','Forged override'),/Full payment/);
  await run('OPERATIONS',()=>prisma.order.update({where:{id:order.id},data:{paidAmountCents:9999,paymentStatus:'PAID'}}));
  await assert.rejects(depart('IN_TRANSIT'),/Full payment/);
  await run('OPERATIONS',()=>prisma.order.update({where:{id:order.id},data:{paidAmountCents:10000,paymentStatus:'AUTHORIZED'}}));
  await assert.rejects(depart('IN_TRANSIT'),/Full payment/);
  await run('OPERATIONS',()=>prisma.order.update({where:{id:order.id},data:{paymentStatus:'PAID'}}));
  await depart('IN_TRANSIT');
  await run('OPERATIONS',()=>prisma.order.update({where:{id:order.id},data:{status:'READY',paidAmountCents:0,paymentStatus:'PENDING'}}));
  await depart('INSTALLATION','ADMIN','חריגת מנהל מתועדת');
  const history=await run('OPERATIONS',()=>prisma.statusHistory.findFirstOrThrow({where:{orderId:order.id,toStatus:'INSTALLATION'}}));
  assert.equal(history.reason,'חריגת מנהל מתועדת');
  assert.equal((history.metadata as {manualOverride:boolean}).manualOverride,true);
  console.log(JSON.stringify({passed:true,checks:['unpaid blocked at database','employee cannot forge override','partial blocked','authorization is not receipt','fully paid departure','reasoned admin override with atomic history']}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>closeDatabaseConnection());

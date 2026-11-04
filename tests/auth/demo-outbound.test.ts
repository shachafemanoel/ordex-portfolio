import { afterEach, describe, it, expect, vi } from 'vitest';
const db=vi.hoisted(()=>({getPrismaClient:vi.fn(()=>{throw new Error('Must not query subscribers');})}));
vi.mock('@/lib/db',()=>db);
import { notifyOperationsWebPush } from '@/lib/push/webPush';
afterEach(()=>vi.unstubAllEnvs());
describe('tenant demo outbound boundary',()=>{
 it('does not query recipients or send notifications even with provider configuration',async()=>{
  vi.stubEnv('TENANT_ENFORCEMENT','true');vi.stubEnv('VAPID_PUBLIC_KEY','synthetic');vi.stubEnv('VAPID_PRIVATE_KEY','synthetic');
  await notifyOperationsWebPush({title:'Synthetic order',body:'Synthetic only'});
  expect(db.getPrismaClient).not.toHaveBeenCalled();
 });
});

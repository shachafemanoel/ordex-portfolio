import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
const db=vi.hoisted(()=>({findMany:vi.fn(),count:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{product:{findMany:db.findMany,count:db.count}}}));
vi.mock('@/lib/api-middleware',async importOriginal=>{
 const actual=await importOriginal<typeof import('@/lib/api-middleware')>();
 return {...actual,withAuth:(handler:any)=>async(req:any)=>{try{return await handler(req);}catch(e){return actual.handleApiError(e,req);}}};
});
import { GET } from '@/app/api/products/route';
describe('active catalog empty/error responses',()=>{
 beforeEach(()=>{db.findMany.mockReset().mockResolvedValue([]);db.count.mockReset().mockResolvedValue(0);});
 it('returns an explicit empty catalog with pagination',async()=>{
  const response=await GET(new NextRequest('http://localhost/api/products'));const body=await response.json();
  expect(response.status).toBe(200);expect(body.data.items).toEqual([]);expect(body.data.total).toBe(0);
 });
 it('surfaces database failure instead of pretending that the catalog is empty',async()=>{
  db.findMany.mockRejectedValue(new Error('synthetic outage'));
  const response=await GET(new NextRequest('http://localhost/api/products'));expect(response.status).toBe(500);
 });
 it.each(['page=-1','limit=10001','page=garbage'])('rejects invalid pagination %s',async query=>{
  expect((await GET(new NextRequest('http://localhost/api/products?'+query))).status).toBe(400);expect(db.findMany).not.toHaveBeenCalled();
 });
});

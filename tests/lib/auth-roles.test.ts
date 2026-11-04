import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS, getOrderFilterForRole, type AuthenticatedUser } from '@/lib/auth';
const user=(permissions:AuthenticatedUser['permissions']):AuthenticatedUser=>({id:'operator',email:'synthetic@example.invalid',name:'Operator',role:'OPERATIONS',permissions});
describe('business role order filters',()=>{
 it('allows admins to see all orders inside their verified business',()=>expect(getOrderFilterForRole({...user(ROLE_PERMISSIONS.ADMIN),role:'ADMIN'})).toEqual({}));
 it('allows operations to see their business orders under RLS',()=>expect(getOrderFilterForRole(user(ROLE_PERMISSIONS.OPERATIONS))).toEqual({}));
 it('limits users without VIEW_ALL_ORDERS to their assignments',()=>expect(getOrderFilterForRole(user([]))).toEqual({assignedUserId:'operator'}));
});

/**
 * Legacy Auth User Proxy
 * Re-exports from domain/users/normalizeUser for backward compatibility
 * during the Phase 5 refactor.
 *
 * @deprecated Use @/domain/users/normalizeUser instead
 */

export { normalizeRole, normalizeRoleKey } from '@/domain/roles/normalizeRole';
export * from '@/domain/users/normalizeUser';

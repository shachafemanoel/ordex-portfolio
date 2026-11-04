# Shared-business foundation

This draft introduces `Tenant` and `TenantMembership` with ADMIN / OPERATIONS roles. Sessions carry a business hint; current active membership is fetched from the database on every authenticated request. A revoked membership invalidates an existing session.

All 77 business models receive tenant ownership. Natural identifiers (SKU, order number, Woo IDs, configuration keys) are unique within the business. The v1 connection model permits one Woo shop per business. Existing rows and users are assigned to the `legacy` business by the migration, without deleting or duplicating them.

PostgreSQL FORCE ROW LEVEL SECURITY protects model queries, raw SQL and implicit Prisma join tables. Database triggers reject references to a different business and assignment to a non-member. Orders/customers cannot be hard deleted. Prisma establishes transaction-local context and preserves callback transaction atomicity. Array-form transactions are rejected in tenant runtime.

The runtime role must have no SUPERUSER, BYPASSRLS, table ownership or inherited table-owner membership. The server refuses roles/tables that fail those checks. `scripts/provision-runtime-role.mjs` provisions a separate role using migration-owner `DIRECT_URL` and an operator-supplied `DATABASE_RUNTIME_PASSWORD`; it does not print credentials. Set the web/worker `DATABASE_URL` to this role. `DIRECT_URL` remains migration-only. Render manifests deliberately require a manually configured runtime URL. Production validation requires `TENANT_ENFORCEMENT=true`.

The legacy shared Redis stores are disabled in tenant runtime. The core in-memory cache prefixes each key and invalidation with the verified business. A durable PostgreSQL inbox is the intended Woo worker queue. Unsupported API families are blocked at the server entry point. Tenant invitations and Woo job tables are schema foundations; their workflows are not delivered by this PR.

## Verification

On 2026-10-28, the baseline Prisma schema was installed in a disposable local PostgreSQL 18 database, populated with a synthetic existing user/customer, and this migration applied in one transaction. Both records and their new legacy membership remained present. This verifies the delta against the prior schema; it does not verify the historical migration chain or a production-data rehearsal.

`TENANT_ENFORCEMENT=true NODE_ENV=test SKIP_PRISMA_INIT=true DATABASE_URL=<restricted disposable local database> node --import tsx scripts/verify-tenant-isolation.ts` passed 18 checks: default ownership; list/count and ID isolation; rejected cross-business write, ownership change, child reference, implicit join and user assignment; identical SKU/order/Woo ID in two businesses; raw SQL scope; rollback; missing context; forged selection; membership revocation; raw hard-delete prevention; concurrent connection context; cache access/invalidation isolation.

This is a foundation draft, not release approval. The complete historical unit suite remains failing as documented in `quality-status.md`. Invitation/switching UI, per-business Woo processing, current visual acceptance, production backup rehearsal and external deployment verification remain release requirements.

# Release deployment and recovery

Prepared Blueprints: `render.staging.yaml` and `render.yaml` use separate service names, databases, Redis and secrets. No cloud resources have been created. Render reauthentication and approval of current costs are required before applying either file. Do not reuse runtime credentials or production data in staging. The Woo worker will be added once its tenant-safe implementation is verified.

The selected compute identifiers follow https://render.com/docs/blueprint-spec (checked 2026-10-28). They are a configuration proposal, not an approved purchase. Confirm their capacity against the pilot load before provisioning.

## Release sequence
1. Run the full quality gate and the two-business acceptance suite on the exact release commit. The complete legacy suite currently fails, so deployment is blocked.
2. Confirm credential rotation and provider smoke checks. Do not copy credentials into an issue, PR or build log.
3. Create an encrypted-provider-managed or private mode-600 backup with `npm run backup:create -- /absolute/path.dump`. A SHA-256 checksum is emitted; backup contents are never printed. Store the backup off-host under restricted access before migration.
4. Replay migrations on an isolated copy and verify data counts. `npm run release:migrate` executes `prisma migrate deploy` once using DIRECT_URL when available. Any failure blocks the release; inspect and repair through a reviewed migration. Never mark an unknown failure applied or reset the runtime database.
5. Manually deploy the approved SHA to staging. Verify login, roles, business isolation, Woo import, worker health and the core workflow.
6. Deploy the same SHA to production after release approval. Startup validates its environment and only starts the server. It does not seed data, create a default admin, generate clients or run migrations.
7. Verify the health endpoint and pilot workflow. Roll back application code only to a commit demonstrated to be compatible with the migrated schema. If data recovery is required, restore to a separate database and review before changing runtime connections.

## Restore exercise
Create an empty local disposable database named `retzef_restore_*` and set RESTORE_TEST_DATABASE_URL to it. Run `npm run backup:verify -- /absolute/path.dump`. The command refuses remote servers, other database names and non-empty databases. No source database is modified. A synthetic table was backed up and restored successfully locally on 2026-10-28; this does not verify real production data, provider backups or the full OMS schema.

## Remaining release blockers
Tenant enforcement, invitations, tenant-specific Woo connections and durable processing, authenticated UI review, the complete regression suite, real provider connectivity, worker monitoring and a two-business pilot. No production readiness claim is made by these deployment changes.

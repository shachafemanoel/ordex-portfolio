# Retzef external demo release

This is the single release record for the guided synthetic-data demo requested on 2026-10-29. It is not approval for real customer data or independent prospect access.

## Baseline and preservation

Base: `f2456602fa0c6acf23335336be42d1e495e6c612` (main, Woo intake stage 1 merged).
The parallel `codex/retzef-woocommerce-connection` checkout at `7145bcf0` was preserved before editing: tracked binary patch, all 11 non-ignored untracked files, status and HEAD; the original checkout's README patch was also saved separately. The merged connection/UI/credentials/receiver replace that older parallel implementation. Its global-credential protections and security tests will be assessed individually; its routes and encryption format must not replace the merged contracts.

## Product contract

- A real sandbox WooCommerce store, no real charges. First import: catalog and open orders only (`pending`, `on-hold`, `processing`). Unknown statuses require review.
- New imported orders start RECEIVED. Commerce status never advances operational status. Cancellations/refunds update commercial information and require review, blocking normal departure.
- Store owns items, totals, currency and payment. Retzef owns scheduling, notes and locally edited addresses, with a visible difference indicator.
- Full payment before delivery/installation. Only an ADMIN can override conditions, with an audited reason. Payment method selection does not confirm receipt.
- Tenant-scoped ADMIN and OPERATIONS accounts, invitation only. No authentication bypass flags. Encrypted store keys, no global fallback.
- At most five processing attempts: waits of 1, 5, 15 and 60 minutes. Authorization/invalid-data failures require intervention. No store replacement after data ingestion; same-store key rotation is supported.
- Out of scope: historical migration, payment collection, subscriptions, iOS, two-way order sync, AI, outbound messages and full procurement.

## Quality and acceptance

Required: Node 22 clean lockfile install; Prisma; complete typecheck; lint; i18n; active-path tests; build; migrations on empty PostgreSQL; tenant/cache/job isolation; manual and store order flows; payment and override checks; duplicate/out-of-order/parallel/restart/revoked-key cases; RTL/keyboard/empty/error states at 390/768/1440; real store test; backup/restore; three consecutive cloud demo runs.

The complete suite must be audited individually. No historical exclusions are approved yet. Changes to any exception inventory require PR review with the failed test, frozen owning module, reason and server-blocking evidence.

## Current verified facts

- Repository Actions were disabled. Enabled on 2026-10-29; dispatch then reproduced HTTP 422 at ci.yml line 111: `runner.temp` is not available in job-level env. This change moves the path assignment into a step via GITHUB_ENV.
- Node 22.23.4 official binary downloaded and SHA-256 verified. Clean `npm ci --ignore-scripts` succeeded; Prisma Client 7.3 generated explicitly. Normal postinstall no longer runs `npm dedupe` or ignores generation failure.
- Local full typecheck passed; ESLint passed with 20 warnings; translation audit passed (765 keys); MVP passed (29 files / 223 tests).
- Full migration chain on an empty local PostgreSQL 18 database passed. Restricted-role checks passed: 18 tenant checks, 14 invitation/session checks, 9 order-flow checks and 6 receiver checks. CI uses PostgreSQL 16; its results are still required.
- Full Vitest diagnostic: 64 failed files, 106 failed tests, 450 passed, 130 skipped. `historical-test-inventory.json` records each failing suite; all remain unapproved blockers.
- Render connector requires reauthentication. No services have been created or paid work authorized.

## Release blockers

Pending: verified CI results; complete historical-test audit; durable worker/processor; import and monitoring; payment/field ownership enforcement; demo provisioning/reset; browser and real-store acceptance; full backup/restore; approved cloud budget; three consecutive cloud demonstrations. Do not declare completion until evidence for every gate is recorded here.

## Woo processing verification

The first processing slice adds a restricted-context PostgreSQL worker with SKIP LOCKED claims, 60-second leases and claim-token fencing. Order/customer/address/items/history and job success commit together. Source identity includes the business and connection; guest customers are scoped by order rather than guessed from contact details. Source versions prevent stale writes. Store changes retain local scheduling, notes, line readiness and protected shipping addresses. Database triggers reject local changes to source commerce.

Local PostgreSQL verification passed twelve scenarios: duplicate enqueue, concurrent claim, atomic aggregate creation/history, RECEIVED/unpaid defaults, local fields, reversed versions, cross-business IDs, protected commerce, crash recovery, stale claim fencing, invalid totals and revoked keys. Transform/retry unit tests: 16 passed. Browser, cloud and real Woo acceptance remain pending.

CI follow-up: the YAML dispatch now succeeds, but GitHub reports `startup_failure` with zero jobs/check-run diagnostics on the dispatched run (40848810638). Three-job execution is still blocked; GitGuardian success is not accepted as a substitute.

## Payment and address verification

Selecting a payment method in the manual wizard now creates a pending payment. Only confirmed receipts count toward paid amounts; authorizations are excluded. Both departure guards and a database trigger enforce full payment and unresolved store-review flags. The existing admin override records a reason and history atomically. Local address edits also refresh the order's visible address fields and display an override indicator.

Verified locally: 243 MVP tests; full typecheck; six PostgreSQL departure scenarios (unpaid, partial, authorization, forged employee override, paid departure, documented admin exception). Browser tests now explicitly confirm that method selection leaves the order unpaid, assert the departure denial, then record a receipt. Their execution is still pending.

## Import and operations verification

Admin-only POST preview, POST import, GET jobs and POST jobs/[id]/retry preserve the original connection/webhook routes. Preview pages show unknown/closed statuses explicitly. Approval is tenant-bound, expires after 15 minutes and is idempotent. Import pages enqueue catalog/open-order records through the worker's existing processors; each page and record has its own bounded retry state. Duplicate imports and live events share source identity/version protection. Jobs responses omit source payloads and credentials. Manual retry is audited and preserves the five-total-attempt ceiling.

The Hebrew operations screen includes preview pagination/approval, job pagination, progress, failures, worker heartbeat and the specified two/five-minute alerts. PostgreSQL checks passed thirteen scenarios including overlapping live import, repeated import, same external IDs/SKU in two businesses, foreign preview/retry denial, employee denial and bounded retries. Full typecheck passed. Browser visual/accessibility verification is still pending.

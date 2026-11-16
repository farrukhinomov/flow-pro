# Maintenance Guide

This guide explains how to keep FlowPro easy to change. It is intentionally
practical: follow it before and during normal feature work.

## Current Documentation Location

All maintained docs live in `docs/`.

Do not add new root-level markdown guides. Add new docs under the closest
subfolder:

- `docs/frontend`
- `docs/backend`
- `docs/shared`
- `docs/operations`
- `docs/architecture/backend/decisions`
- `docs/architecture/backend/compliance`

Use `docs/archive` only for historical material that should not guide current
development.

## Daily Commands

Frontend:

```sh
cd apps/web
npm run dev
npm run maintenance
npm run check:quick
npm run check
```

Backend:

```sh
cd apps/api
dotnet test FlowPro.slnx
bash scripts/check.sh
```

Integrated e2e:

```sh
cd apps/web
npm run test:e2e
```

## What The Frontend Maintenance Scan Checks

`npm run maintenance` scans frontend source files for:

- largest files
- route files above the split threshold
- domain files without tests
- obvious debug/demo/template markers

Keep route files under 900 lines. Split large features into:

- `features/<area>/components/*`
- `features/<area>/hooks/use-*.ts`
- `features/<area>/<area>-view-model.ts`
- `domain/<area>/*.ts`

## Frontend Maintenance Rules

1. Keep route files thin. Routes compose pages, parse search params, and guard
   access.
2. Put business rules in `src/domain`, then add or update tests.
3. Put write orchestration in `src/application`.
4. Put HTTP transport in `src/data/api`.
5. Put IndexedDB access in `src/data/local`.
6. Put sync pull/apply/outbox behavior in `src/data/sync`.
7. Keep shared UI in `src/components`, not inside routes.
8. Use the signed-in session from access/session helpers. Avoid hardcoded
   default employee IDs in UI.
9. Keep console output behind `src/lib/logger.ts`.
10. When local DB stores change, bump `LOCAL_DB_SCHEMA_VERSION`, update
    migration notes, and update [Frontend sync engine](../architecture/frontend/sync-engine.md).

## Backend Maintenance Rules

1. Keep dependency direction:

   ```text
   FlowPro.Api -> FlowPro.Application -> FlowPro.Domain
               -> FlowPro.Infrastructure -> FlowPro.Application + FlowPro.Domain
   FlowPro.Worker -> FlowPro.Infrastructure
   ```

2. Keep business invariants in `FlowPro.Domain`.
3. Use explicit application command/query handlers.
4. Put EF Core and PostgreSQL details in `FlowPro.Infrastructure`.
5. Require endpoint authorization policies.
6. Enforce ownership and tenant checks in handlers/repositories.
7. Commit audit and outbox records in the same transaction as the business
   write.
8. Use migrations for schema changes.
9. Add focused tests before broad e2e tests.
10. Update backend docs when endpoint, auth, sync, migration, storage, or
    operational behavior changes.

## Contract Maintenance Rules

When changing backend payloads:

1. Update backend contracts in `FlowPro.Application`.
2. Update endpoint binding in `FlowPro.Api`.
3. Update frontend DTOs and mappers in `apps/web/src/data/api`.
4. Update runtime schemas in `apps/web/src/contracts/api.ts` when applicable.
5. Update [Shared API contracts](../architecture/api-contracts.md).
6. Run frontend and backend tests.

## Current Watch Areas

The latest frontend maintenance scan found:

- no route file above the split threshold
- every non-type domain file has a matching test
- no obvious template/demo/debug markers

Large files to watch as the app grows:

- `apps/web/src/i18n/messages.ts`
- `apps/web/src/domain/users/seeds.ts`
- `apps/web/src/features/users/components/organization-admin.tsx`
- `apps/web/src/components/ui/sidebar.tsx`
- `apps/web/src/features/timesheet/timesheet-view-model.ts`
- `apps/web/src/data/sync/sync-engine.ts`

Large files are not automatically wrong. Split them when review, testing, or
navigation becomes difficult.

## Before You Finish A Change

Use this checklist:

1. Did I put the code in the right layer?
2. Did I update tests at the cheapest reliable level?
3. Did I update docs for changed behavior?
4. Did I avoid stale root docs or duplicated guidance?
5. Did I run the relevant verification commands?
6. Did I avoid reverting unrelated work in the dirty worktree?

## Bug Discipline

Use [Quality discipline](quality.md) for bug triage. High severity bugs have a
48-hour fix or mitigation SLA. Normal bugs have a seven-day SLA. Do not allow a
silent bug backlog to grow while feature work continues.

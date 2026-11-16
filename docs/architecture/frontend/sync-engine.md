# Frontend Local Data And Sync Engine

FlowPro is moving toward server-authoritative workflows, but the frontend still
contains an offline-capable local cache and outbox. This document explains how
to maintain that code safely.

## Source Files

- `src/data/local/db.ts`: IndexedDB schema, stores, migrations, import/export.
- `src/data/local/*.repo.ts`: local repositories and outbox producers.
- `src/data/sync/sync-engine.ts`: pull/apply/push loop and conflict handling.
- `src/data/sync/local-sync-client.ts`: sync batch submission wrapper.
- `src/domain/sync/protocol.ts`: protocol request/response contract.
- `src/features/sync/*`: sync status UI and operation actions.
- `src/application/sync-effects.ts`: startup side effects.

## Local Database Responsibilities

IndexedDB is a browser cache plus outbound queue. It is not the legal source of
truth for production records.

Stores:

- `clockEvents`: cached canonical attendance events.
- `employeeRequests`: request cache and local-first request records.
- `absences`: approved absence cache from workflow side effects.
- `attendanceTypes`, `attendancePolicyConfigs`: local-first policy/catalog data.
- `employeeUsers`: local-first people/access cache.
- `managerDelegations`, `organizationCatalogs`: organization support data.
- `notifications`, `notificationPreferences`: notification cache/preferences.
- `payrollExports`, `timesheetApprovals`, `timeCorrections`: workflow caches.
- `auditEvents`: cached audit projection for fast reads. Backend audit remains
  the legal source of truth.
- `outbox`: queued sync operations.
- `syncMeta`: health, cursor, pending count, and last error.

When adding a store or changing shape:

1. Update `STORE_NAMES`.
2. Update `upgradeDatabase()`.
3. Bump `LOCAL_DB_SCHEMA_VERSION`.
4. Add a `MIGRATION_NOTES` entry.
5. Update import/export/reset expectations.
6. Add or update tests that cover the affected workflow.

## Push Flow

`syncAttendanceOutbox()` is the main sync loop:

1. Stop if another sync is already in flight.
2. Mark offline immediately when `navigator.onLine` is false.
3. Pull server changes before pushing local operations.
4. Load pending or failed outbox operations.
5. Mark each operation `syncing`.
6. Send one operation per sync batch through `sendOperationToLocalSyncClient()`.
7. Mark accepted operations `synced` and update cached aggregate state.
8. Mark rejected failures as `failed`.
9. Mark server conflicts as `conflict` and stop processing.
10. Pull server changes again after the push loop.
11. Emit a sync-change event so UI can refresh.

The loop intentionally stops after the first failed or conflicted operation so
later operations do not reorder around a broken dependency.

## Pull Flow

`pullServerSyncChanges()` reads `/sync/changes` using the stored server cursor.
Each server event is applied through `applyServerSyncChange()`.

Supported event family:

```text
client-aggregate.*
```

Supported aggregate caches include clock events, requests, absences,
notifications, payroll exports, users, timesheets, attendance policy/config,
attendance types, organization catalogs, and notification preferences.

Pulling is capped at ten pages of one hundred items per run to avoid an
unbounded foreground sync loop.

## Application Store Hydration

`src/application/application-store-hydration.ts` refreshes local-first read
projections for dashboards and operator screens.

Hydration has two paths:

- Client aggregate feeds for modules that already expose a generic projection
  feed, such as requests, absences, notifications, timesheets, and users.
- Dedicated workflow reads for read-only or composed packages, such as audit,
  organization catalogs, employment contracts, planning, and reports.

Audit hydrates through `GET /api/v1/audit-events` and caches events in
`auditEvents` for fast operator reads. This cache is not legal truth. Planning
hydrates through `GET /api/v1/planning-workflows/{periodMonth}` for the current
month and caches the returned package in `planningPackages`. Reports hydrate
through `GET /api/v1/report-workflows/{periodMonth}` for the current month and
cache the returned package in `reportsPackages`. Do not move audit, planning,
payroll, or legal report writes into local-only queues. Backend workflows remain
authoritative.

## Conflict Handling

Server conflicts are represented as `LocalSyncConflictError` and stored on the
outbox operation with:

- message
- server version
- remote payload
- optional resolution metadata

UI actions:

- Retry sets the operation back to `pending`.
- Cancel marks it `cancelled`.
- Remote wins applies the remote payload and marks the operation `synced`.
- Local wins marks the operation `pending` with resolution metadata and resends.

Do not silently overwrite conflict records. Conflict resolution must remain a
visible user or administrator decision.

## Server-Authoritative Attendance Path

Attendance clocking and corrections now use backend command APIs first:

- `src/application/attendance-workflow.ts`
- `src/data/api/attendance.gateway.ts`
- `src/data/api/attendance.api.ts`

These commands return canonical server bookings. The frontend then updates
IndexedDB as a cache and refreshes `syncMeta`.

If the API is unavailable when reading, the gateway falls back to cached local
events. If a write API fails, the user should see the failure rather than
silently creating legal attendance records only in IndexedDB.

## Rules For New Syncable Aggregates

1. Add the aggregate and operation type to `src/contracts/api.ts`.
2. Add the operation creator in the relevant domain command module.
3. Ensure local repository writes call `enqueueOutbox()`.
4. Teach `sync-engine.ts` how to apply pulled server payloads.
5. Add server support in `../../apps/api/src/FlowPro.Application/Sync` and
   document permissions in [Backend sync](../backend/sync.md).
6. Add application or e2e tests that prove accepted, rejected, and conflict
   behavior where risk is high.

## Operational Checks

Use Settings > Sync Health to inspect local projection hydration. Use Settings >
Quality Health to compare local-first signals with backend operations health.
Quality Health reads:

- local `syncMeta`
- local outbox state
- local audit integrity
- `GET /api/v1/operations/health`

If the backend health request is unavailable, the page must say so and continue
showing local signals. It must not silently mark the system healthy.

Run before release:

```sh
npm run check
npm run format:check
npm run test:e2e
```

The integrated e2e suite must include a backend-backed persistence check before
sync can be called release-ready.

# Backend Synchronization Guide

The backend sync module stores client aggregates, validates sync operations,
detects conflicts, writes audit records, and emits tenant-scoped outbox events
for clients to pull.

PostgreSQL remains the source of truth. Client IndexedDB databases are caches
and outbound queues.

## Source Files

- `src/FlowPro.Api/Sync/SyncEndpoints.cs`
- `src/FlowPro.Application/Sync/SyncCommandHandler.cs`
- `src/FlowPro.Application/Sync/SyncQueryHandler.cs`
- `src/FlowPro.Application/Sync/SyncContracts.cs`
- `src/FlowPro.Domain/Sync/ClientAggregate.cs`
- `src/FlowPro.Infrastructure/Sync/SyncAggregateRepository.cs`
- `src/FlowPro.Infrastructure/Integration/OutboxStore.cs`
- `src/FlowPro.Infrastructure/Persistence/Migrations/*ClientAggregate*`

Frontend counterpart:

- [Frontend sync engine](../frontend/sync-engine.md)

## Endpoints

```text
POST /api/v1/sync/batches
GET  /api/v1/sync/changes?after=<sequence>&limit=<count>
```

Policies:

- `/sync/batches`: `sync.write.self`
- `/sync/changes`: `sync.read.self`

## Batch Request Contract

Current protocol:

```text
flowpro-sync-v1
```

Validation rules:

- protocol must match
- client id is required
- a batch may contain at most 100 operations
- aggregate must be in the allowed aggregate list
- operation prefix must match aggregate
- conflict resolution must be empty, `local-wins`, or `server-wins`
- caller must have the required permission

## Allowed Aggregates

The current sync handler accepts:

- `absence`
- `approval-workflow`
- `attachment`
- `attendance-policy`
- `attendance-type`
- `notification`
- `notification-preferences`
- `organization-catalog`
- `payroll-export`
- `request`
- `timesheet`
- `user`

Attendance `clock-event` writes are intentionally not accepted through generic
sync. Legal attendance bookings use the attendance command API.

## Conflict Detection

The server stores one `ClientAggregate` per tenant, aggregate type, and
aggregate id.

Conflict rule:

- If the same operation id was already accepted, return the existing server
  version. This makes retries idempotent.
- If the current server aggregate has a newer client timestamp than the incoming
  operation and the operation does not declare `local-wins`, return a conflict.
- If `local-wins` is present, accept the incoming payload and audit the conflict
  resolution.

The server returns remote payload and server version for client-side conflict
resolution.

## Ownership And Permissions

Tenant-wide aggregates do not get an owner:

- `attendance-policy`
- `attendance-type`
- `organization-catalog`

Other aggregates resolve owner from existing aggregate owner or payload fields
such as:

- `ownerUserId`
- `userId`
- `employeeId`
- `recipientUserId`
- `uploadedByUserId`

Notification and notification preference operations allow own-record permission
or a manage permission. Other operations map directly to permission keys.

## Outbox Events

Accepted operations write a transactional outbox message:

```text
client-aggregate.upserted.v1
client-aggregate.deleted.v1
```

The payload includes:

- aggregate
- aggregate id
- operation type
- deleted flag
- payload
- client operation id
- client id
- server version
- synced timestamp
- owner user id

Clients pull these ordered events through `/sync/changes` and update local
caches.

## Projection Feed Direction

New backend-first workflows should publish client-safe projection events rather
than leaking internal domain event payloads. Shared projection contracts live in:

```text
src/FlowPro.Application/Sync/ClientProjectionContracts.cs
```

Projection events should include:

- projection name
- projection id
- deleted flag
- client-safe payload
- occurred timestamp
- optional owner user id

Use projection events for local cache updates after backend workflows such as
users, timesheets, planning, reports, payroll artifacts, notifications, and
organization changes.

## Audit Events

Every accepted sync operation writes an audit event with:

- operation id
- operation type
- aggregate
- aggregate id
- client id
- protocol
- schema version
- client timestamp
- server version
- owner user id
- deletion flag
- conflict resolution mode

Audit entries help explain why a client-visible aggregate changed.

## Adding A New Syncable Aggregate

1. Confirm the aggregate should be generic client sync, not a
   server-authoritative command.
2. Add aggregate name to `AllowedAggregates`.
3. Add operation-to-permission mapping.
4. Add owner resolution rules if it is user-owned.
5. Add frontend DTO and outbox operation support.
6. Teach frontend pull application to cache the aggregate.
7. Add tests for accepted, rejected, conflict, and authorization paths.
8. Update this document and [Frontend sync engine](../frontend/sync-engine.md).

## Do Not Use Sync For

- Legal attendance bookings.
- Payroll export snapshots that must be generated server-side.
- Permission grants or role assignments that should be server-authoritative.
- Anything where accepting arbitrary client payloads would bypass a domain
  invariant.

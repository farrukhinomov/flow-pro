# Backend Architecture

FlowPro backend is a .NET 10 modular monolith. This is deliberate: attendance
commands, approvals, audit records, timesheet snapshots, and payroll evidence
need strong transactional consistency more than independent service deployment.

## Stack

- ASP.NET minimal APIs
- .NET 10
- EF Core 10
- PostgreSQL
- Npgsql
- built-in accounts with server-side cookie sessions
- database-backed permission authorization
- lightweight CQRS without a mediator package
- transactional audit and outbox
- background worker for outbox dispatch
- xUnit tests

## Projects

```text
apps/api/src
├── FlowPro.Api             # HTTP endpoints, auth setup, OpenAPI, health
├── FlowPro.Application     # commands, queries, handlers, ports, contracts
├── FlowPro.Domain          # entities, invariants, domain errors
├── FlowPro.Infrastructure  # EF Core, repositories, outbox, auth queries
└── FlowPro.Worker          # background outbox dispatch
```

Tests live in:

```text
apps/api/tests
├── FlowPro.Domain.Tests
├── FlowPro.Application.Tests
└── FlowPro.Architecture.Tests
```

## Dependency Direction

```text
FlowPro.Api -> FlowPro.Application -> FlowPro.Domain
            -> FlowPro.Infrastructure -> FlowPro.Application + FlowPro.Domain

FlowPro.Worker -> FlowPro.Infrastructure
```

Rules:

- `Domain` has no dependency on other FlowPro projects.
- `Application` depends only on `Domain`.
- `Infrastructure` may implement `Application` ports and use `Domain`.
- `Api` and `Worker` are composition roots.
- Do not introduce a mediator, generic repository, or service abstraction unless
  it removes demonstrated complexity.

Architecture tests enforce the most important boundaries.

## Layer Responsibilities

| Layer | Owns | Must Not Own |
| --- | --- | --- |
| `FlowPro.Api` | HTTP binding, auth policies, CORS, rate limits, OpenAPI, health | business invariants, EF queries |
| `FlowPro.Application` | use cases, commands, queries, contracts, permissions, transaction orchestration | endpoint routing, EF configuration |
| `FlowPro.Domain` | entities, invariants, state transitions, domain exceptions | DI, EF, HTTP, logging |
| `FlowPro.Infrastructure` | EF Core, PostgreSQL repositories, locks, audit/outbox persistence, permission queries | UI contracts, endpoint routing |
| `FlowPro.Worker` | background outbox dispatch and scheduled work | request/response behavior |

## Vertical Module Pattern

Add behavior vertically through matching folders:

```text
FlowPro.Api/<Area>/<Area>Endpoints.cs
FlowPro.Application/<Area>/<Area>Contracts.cs
FlowPro.Application/<Area>/<Area>Handler.cs
FlowPro.Application/<Area>/I<Area>Repository.cs
FlowPro.Infrastructure/<Area>/<Area>Repository.cs
FlowPro.Domain/<Area>/<Entity>.cs
```

Not every slice needs every file. Pure query projections may not need new
domain entities. Simple modules may share an existing repository.

## Current Backend Areas

- Attendance: authoritative time booking commands and queries.
- Requests: workflow documents, approval decisions, side effects, payroll export
  workflow trigger.
- Timesheets: monthly snapshot read/sign/reopen/export markers.
- Users: directory list/upsert/invite/deactivate/reactivate.
- Organization: catalogs, manager delegations, employment contracts.
- Planning: backend-first planning package query.
- Reports: backend-first report package query.
- Payroll artifacts: retained export artifact creation/list/download.
- Notifications: notification list, read-state commands, preferences.
- User preferences: per-user locale, time zone, week start, and display
  settings, replacing browser-local storage.
- Onboarding: workspace claim, tenant provisioning, and setup wizard progress.
- Attendance policies: versioned revisions with effective dates, point-in-time
  reads, and published history.
- Sync: client aggregate submit and tenant-scoped change feed.
- Attachments: local object storage-backed upload/download/delete.

## CQRS

The application layer uses lightweight CQRS:

- commands change state
- queries are side-effect free
- each use case has an explicit handler
- handlers use direct dependency injection
- there is no mediator package
- read and write models currently share PostgreSQL

Commands own validation, permission-sensitive orchestration, transactions,
audit events, and outbox messages.

## Transaction Rules

Every legal or user-visible write should happen in one transaction:

1. Load tenant/user context.
2. Check permissions and ownership.
3. Load or create domain state.
4. Apply domain transition.
5. Persist business changes.
6. Add audit event.
7. Add outbox message.
8. Commit once.

Do not write audit or outbox records after the transaction commits. Evidence and
integration messages must commit with the business change.

## Multi-Tenancy

Every tenant-owned table contains `tenant_id`. Repository queries must include
the tenant identifier resolved from authentication.

PostgreSQL row-level security enforces the same boundary underneath. Every
tenant-owned table has a forced `tenant_isolation` policy that shows a row only
when its tenant matches the `flowpro.tenant_id` setting, which the
`TenantConnectionInterceptor` sets on every connection for the signed-in member.
Without a member, tenant-owned tables look empty. RLS is defense in depth; it
does not replace application authorization.

- The application connects as an ordinary role that owns the database, never a
  superuser or a role with `BYPASSRLS`, which skip the policies.
  `DatabaseRoleGuard` refuses to start otherwise.
- Code that must span workspaces says so with `AcrossTenantsAsync`, which sets
  `flowpro.scope = 'cross-tenant'` for one call: resolving which workspace a
  session acts in, an account's workspace list, invitation links, onboarding's
  uniqueness checks, the outbox worker and the demo reset's safeguard. Keep
  those queries narrow and filtered by the caller's own keys.
- A new tenant-owned table needs the policy in its migration, as in
  `EnforceTenantRowLevelSecurity`. `TenantIsolationTests` fails for a table
  without one.
- A data migration that touches tenant rows must set the scope itself
  (`SET LOCAL flowpro.scope = 'cross-tenant'`); the migration bundle runs
  without the interceptor.

## Authentication And Authorization

FlowPro authenticates accounts itself with server-side sessions (see
[auth](auth.md)). The server stores the account, its link to each tenant
membership, lifecycle status, roles, and permissions.

Authorization rules:

- endpoints require permission policies
- handlers perform additional ownership checks when needed
- permissions are queried from PostgreSQL
- frontend role checks are never trusted
- development header auth is Development-only

See [Backend auth](auth.md).

## Outbox And Synchronization

Domain changes and outbox messages commit in the same transaction. The worker
claims outbox messages with `FOR UPDATE SKIP LOCKED`, allowing multiple worker
replicas without duplicate concurrent dispatch.

The ordered tenant-scoped outbox sequence feeds client sync changes. Some
compatibility events carry client aggregate payloads for modules still using
local-first cache behavior.

See [Backend sync](sync.md) and [Workflow migration](workflow-migration.md).

## Verification

From `apps/api`:

```sh
dotnet test FlowPro.slnx
bash scripts/check.sh
```

`bash scripts/check.sh` verifies tool restore, restore, formatting, Release
build, tests, package vulnerabilities, and pending EF model changes.

## Change Checklist

1. Decide the module and layer for the change.
2. Put invariant-heavy behavior in `Domain`.
3. Add explicit `Application` command/query contracts.
4. Implement one focused handler.
5. Add or update infrastructure repositories.
6. Register dependencies.
7. Add a focused endpoint with the narrowest permission.
8. Add tests at domain/application level first.
9. Update API, auth, sync, migration, or operation docs as needed.
10. Run verification.


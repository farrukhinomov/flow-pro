# FlowPro Server

FlowPro Server is the authoritative backend for attendance, requests, approvals,
timesheets, payroll preparation, and workforce planning.

The backend is a .NET 10 modular monolith backed by PostgreSQL. The browser,
mobile apps, desktop apps, terminals, and kiosks are clients. Their local
databases are caches and outboxes only.

## Implemented foundation

- Multi-tenant identity, roles, permissions, employees, teams, departments,
  locations, and employment contracts
- Server-authoritative clock-in, break, resume, and clock-out commands
- Manual bookings, audited voids, and corrections that preserve original records
- Lightweight CQRS with explicit command/query handlers and no mediator package
- PostgreSQL advisory locks that serialize attendance commands per employee
- Idempotency keys and terminal device sequence uniqueness
- Immutable audit events and non-deletable time-booking evidence
- Transactional outbox and tenant-scoped synchronization feed
- Server-generated UUIDv7 identifiers and UTC server timestamps
- Database-backed authorization policies
- Built-in accounts with cookie sessions, and development-only header
  authentication for automated tests
- Health checks, OpenAPI with Scalar UI, rate limiting, CORS, structured logging,
  and worker
- Initial PostgreSQL migration, Docker setup, VS Code tasks, and tests

The completed end-to-end client integration covers Today attendance, booking
corrections, request submission and approval, worker/manager Timesheet
visibility, monthly sign-off, and payroll/PDF export persistence. Attachment,
notification, and subscription modules remain separate vertical slices.

## Prerequisites

- .NET SDK 10.0.404 or a later 10.0 release (`global.json` rolls forward within 10.0)
- A container runtime with Compose support, such as Docker Engine or Podman
- VS Code with the recommended extensions

All NuGet dependencies are free and open source. No paid packages are used.

## Local development

Open `apps/api` as the VS Code workspace.

```bash
docker compose -f ../../compose.yaml --profile tools up -d postgres mailpit pgadmin
dotnet tool restore
dotnet run --project src/FlowPro.Api
```

In another terminal:

```bash
dotnet run --project src/FlowPro.Worker
```

The API starts at `http://localhost:5123`. In Development, migrations and demo
data are applied automatically.

- Scalar API reference: `http://localhost:5123/scalar`
- OpenAPI document: `http://localhost:5123/openapi/v1.json`
- pgAdmin: `http://localhost:5050`
- pgAdmin login: `admin@flowpro.local` / `superadmin`
- PostgreSQL password when opening the registered server: `superadmin`
- FlowPro development superadmin: `founder@flowpro.local` / `superadmin`
- FlowPro development employee: `hannah.fischer@flowpro.test` / `superadmin`

These are distinct identities on purpose. `admin@flowpro.local` signs into
pgAdmin and is overridable with `FLOWPRO_PGADMIN_EMAIL`.
`founder@flowpro.local` is the seeded FlowPro account inside the product. They
previously shared one address, which also happened to be a maintainer's real
mailbox committed to a public repository.

The values above are local development defaults only. `compose.public.yaml`
requires every credential to be supplied and fails to start without them.

Use `src/FlowPro.Api/FlowPro.Api.http` to call the API.

Run the complete containerized stack from the repository root with:

```bash
docker compose up --build
```

Sign in from the command line with a cookie jar. The `Origin` header is
required for state-changing requests:

```bash
curl -fsS -c cookies.txt -H 'Origin: http://localhost:5123'   -H 'Content-Type: application/json'   -d '{"email":"founder@flowpro.local","password":"superadmin"}'   http://localhost:5123/api/v1/auth/sign-in
curl -fsS -b cookies.txt http://localhost:5123/api/v1/auth/session
```

## Verification

```bash
bash scripts/check.sh
```

This verifies formatting, Release build, tests, known package vulnerabilities,
and pending model changes.

Run the integrated browser test from `apps/web`:

```bash
npm run test:e2e
```

The integrated test starts PostgreSQL and the Release API, then verifies Today
attendance, corrections, requests, worker/manager Timesheet visibility,
sign-off, export persistence, mobile layouts, and visual browser smoke coverage
through the real UI and API.

## Database migrations

```bash
dotnet tool run dotnet-ef migrations add MigrationName \
  --project src/FlowPro.Infrastructure \
  --startup-project src/FlowPro.Api \
  --output-dir Persistence/Migrations

dotnet tool run dotnet-ef migrations has-pending-model-changes \
  --project src/FlowPro.Infrastructure \
  --startup-project src/FlowPro.Api
```

Production deployments should run reviewed migrations as a dedicated deployment
step. `Database:ApplyMigrationsOnStartup` defaults to `false`.

## Backup and restore

Use the operational scripts from the repository root with the same environment file
used by Docker Compose. Backups include the PostgreSQL database and the local
attachment volume.

```bash
FLOWPRO_ENV_FILE=.env \
FLOWPRO_BACKUP_DIR=./backups \
bash scripts/backup.sh
```

Restore is intentionally gated. Stop API and worker traffic before restoring
production data.

```bash
FLOWPRO_ENV_FILE=.env \
FLOWPRO_RESTORE_CONFIRM=I_UNDERSTAND \
bash scripts/restore.sh ./backups/20260605T120000Z
```

The scripts write and verify `SHA256SUMS`. Attachment deletes are soft-deletes;
`Attachments:SoftDeletedRetentionDays` controls when a deleted object becomes
eligible for future physical purge.

## Production configuration

Required environment variables include:

```text
ConnectionStrings__FlowPro
Authentication__Authority
Authentication__Audience
```

`Authentication:Mode=DevelopmentHeaders` is accepted only in the Development
environment. Everywhere else the API uses account sessions and checks
permissions against the authoritative FlowPro database.

See [backend architecture](../../docs/architecture/backend/architecture.md) for the
boundaries and consistency rules. The complete documentation index is
[docs/README.md](../../docs/README.md).

Implementation guides:

- [API guide](../../docs/architecture/backend/api.md)
- [Authentication and authorization](../../docs/architecture/backend/auth.md)
- [Synchronization](../../docs/architecture/backend/sync.md)
- [Maintainability guide](../../docs/architecture/backend/maintainability.md)
- [Backend workflow migration plan](../../docs/architecture/backend/workflow-migration.md)

Operational and compliance guides:

- [Production storage decision matrix](../../docs/architecture/backend/storage-decision-matrix.md)
- [Self-hosted admin guide](../../docs/self-hosting/admin-guide.md)
- [Backup and restore guide](../../docs/self-hosting/backup-restore.md)

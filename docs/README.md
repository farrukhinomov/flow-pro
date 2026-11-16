# FlowPro Documentation

This is the canonical documentation home for FlowPro. Start here when you need
to understand, change, test, or deploy the project.

FlowPro has two applications in one repository:

- `apps/web`: React, TypeScript, Vite, TanStack Router, TanStack Query,
  shadcn/Radix UI, Tailwind, IndexedDB local cache, Playwright e2e tests.
- `apps/api`: .NET 10 modular monolith, ASP.NET minimal APIs, EF Core,
  PostgreSQL, built-in accounts with cookie sessions, permission policies, audit, outbox, worker.

PostgreSQL is the legal source of truth for server-backed workflows. Browser
IndexedDB is an offline-capable cache and outbox for local-first or transitional
modules.

## First Reading Path

Read these in order if you are new to the codebase:

1. [Getting started](contributing/getting-started.md)
2. [Maintenance guide](contributing/maintenance.md)
3. [Frontend architecture](architecture/frontend/architecture.md)
4. [Backend architecture](architecture/backend/architecture.md)
5. [Feature development guide](contributing/feature-development.md)
6. [Shared API and DTO contracts](architecture/api-contracts.md)
7. [Quality discipline](contributing/quality.md)

After that, read the focused guide for the area you are changing.

## Common Tasks

| Task | Read |
| --- | --- |
| Run the app locally | [Getting started](contributing/getting-started.md) |
| Add a frontend page or component | [Feature development guide](contributing/feature-development.md), [Frontend architecture](architecture/frontend/architecture.md) |
| Add a backend endpoint or workflow | [Feature development guide](contributing/feature-development.md), [Backend API guide](architecture/backend/api.md) |
| Change authentication or permissions | [Frontend auth](architecture/frontend/auth.md), [Backend auth](architecture/backend/auth.md) |
| Change signup, tenant provisioning, or setup | [Backend onboarding](architecture/backend/onboarding.md), [Frontend auth](architecture/frontend/auth.md) |
| Change DTOs or API payloads | [Shared API contracts](architecture/api-contracts.md), [Backend API guide](architecture/backend/api.md) |
| Change local cache or sync behavior | [Frontend sync engine](architecture/frontend/sync-engine.md), [Backend sync](architecture/backend/sync.md) |
| Prepare a release | [Release checklist](contributing/release-checklist.md) |
| Try FlowPro on your machine | [Quick start](self-hosting/quick-start.md) |
| Deploy to a public server | [Public deployment](self-hosting/public-deployment.md) |
| Back up or restore data | [Backup and restore](self-hosting/backup-restore.md) |
| Run maintenance checks | [Maintenance guide](contributing/maintenance.md) |
| Triage bugs | [Quality discipline](contributing/quality.md) |

## Current Product Areas

- Onboarding: self-serve account registration, tenant
  provisioning, and a four-step first-run setup wizard.
- Attendance: backend-authoritative clock-in, break, resume, clock-out, manual
  bookings, corrections, voids, audit, outbox, and local UI cache.
- Requests: submit, cancel, decide, adjust-and-approve, side effects,
  notifications, approved absences, and local fallback.
- Timesheets: backend-first monthly approval read/sign/reopen/export workflow
  with immutable snapshots and local cache fallback.
- Payroll exports: workflow side effects plus retained export artifacts.
- Users: backend-first directory list/upsert/invite/deactivate/reactivate with
  local cache fallback.
- Organization: catalogs, manager delegations, and employment contracts are
  moving through typed backend workflows.
- Planning and reports: backend-first packages with local projection fallback.
- Notifications and policies: backend-backed workflows with local cache support.

## Documentation Rules

- Docs are grouped by reader: `self-hosting/` for people who run FlowPro,
  `contributing/` for people who change it, and `architecture/` for how it
  is built and why.
- Do not add new root-level guides. Add them here and link them from this file.
- Update docs in the same change as code when behavior, commands, environment
  variables, routes, endpoints, permissions, sync payloads, or deployment steps
  change.
- Prefer small focused guides over large catch-all documents.

## Verification Commands

Frontend:

```sh
cd apps/web
npm run maintenance
npm run check
npm run test:e2e
```

Backend:

```sh
cd apps/api
bash scripts/check.sh
```

Focused backend check:

```sh
cd apps/api
dotnet test FlowPro.slnx
```

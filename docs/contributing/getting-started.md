# Getting Started

This guide gets a developer from a clean checkout to a working local FlowPro
development environment.

## Prerequisites

- Node.js `22.13.0` or newer compatible `20.19+`.
- npm `10` or newer.
- .NET SDK compatible with `net10.0`.
- A container runtime with Compose support, such as Docker Engine or Podman.
- Optionally [Task](https://taskfile.dev), to run the commands in `Taskfile.yml`.
- A browser for the Vite frontend.

The repository includes `.nvmrc` and `.node-version`.

## Repository Map

```text
.
├── docs/                 # canonical documentation
├── apps/web/           # frontend app
├── apps/api/             # backend app, worker, tests
├── docker/               # Dockerfiles, Caddy and service configuration
├── scripts/              # backup and restore
├── compose.yaml          # the whole stack on one machine
└── Taskfile.yml          # one entry point for common commands
```

Most day-to-day work happens in `apps/web/src` and `apps/api/src`.

## Install Frontend Dependencies

```sh
cd apps/web
npm ci
```

Use npm. The active scripts and lockfile are npm-based.

## Start Backend Dependencies

From the repository root:

```sh
docker compose up -d postgres mailpit
```

Mailpit catches the mail the API sends (email confirmation, password reset);
read it at <http://localhost:8025>.

The API connects as `flowpro`, an ordinary role that the database container
creates on its first start. Superusers bypass the row-level security that keeps
workspaces apart. A database volume created before that role existed connects
as a superuser, and the API logs a warning at startup. Recreate the volume, which
deletes local data:

```sh
docker compose down -v
```

For the whole stack in containers, including the web app on
<http://localhost:8088>:

```sh
docker compose up --build
```

For PostgreSQL plus pgAdmin:

```sh
docker compose --profile tools up -d postgres pgadmin
```

`compose.yaml` at the repository root is the only runtime definition. A public
deployment layers `compose.public.yaml` on top of it.

## Run The API

From `apps/api`:

```sh
dotnet tool restore
dotnet restore FlowPro.slnx
dotnet run --project src/FlowPro.Api
```

The API listens on `http://localhost:5123` by default.

Development resources:

- API health: `http://localhost:5123/health/ready`
- Scalar API UI: `http://localhost:5123/scalar`
- OpenAPI JSON: `http://localhost:5123/openapi/v1.json`

In Development, the API can apply migrations and seed demo data when configured
through `Database__ApplyMigrationsOnStartup=true` and
`Database__SeedDevelopmentData=true`.

## Run The Worker

The worker dispatches outbox messages.

```sh
cd apps/api
dotnet run --project src/FlowPro.Worker
```

For many frontend-only tasks you can skip the worker, but backend workflow and
sync testing should include it.

## Run The Frontend

From `apps/web`:

```sh
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server proxies `/api`, `/openapi`, and `/scalar` to
`http://127.0.0.1:5123`.

## Local Authentication

For UI development, use local auth mode and development header auth. The e2e
script configures this automatically.

Useful environment values:

```text
VITE_FLOWPRO_AUTH_MODE=local
VITE_FLOWPRO_DEV_HEADER_AUTH=true
VITE_FLOWPRO_DEV_TENANT_ID=01975fa8-7590-7000-8000-000000000001
VITE_FLOWPRO_DEV_USER_ID=01975fa8-7590-7000-8000-000000000002
VITE_FLOWPRO_DEV_WORKER_USER_ID=01975fa8-7590-7000-8000-000000000010
```

Development header auth is valid only when the API runs in Development with
`Authentication__Mode=DevelopmentHeaders`.
The integrated e2e scenario uses the superadmin user for manager/HR actions and
the seeded worker user for cross-session Today and Timesheet verification.

## Verification

Frontend:

```sh
cd apps/web
npm run maintenance
npm run check
```

Integrated browser test:

```sh
cd apps/web
npm run test:e2e
```

Session browser test (real sign-in, the session cookie, and email links read from
Mailpit; starts PostgreSQL and Mailpit with Docker Compose):

```sh
cd apps/web
npm run test:e2e:session
```

Public demo browser test (the shared logins, the safeguard against wiping a
database with other workspaces, and a real nightly reset scheduled a minute or
two ahead, so it takes about two minutes):

```sh
cd apps/web
npm run test:e2e:demo
```

Backend:

```sh
cd apps/api
bash scripts/check.sh
```

If you only changed one backend area:

```sh
cd apps/api
dotnet test FlowPro.slnx
```

## Where To Go Next

- Read [Maintenance guide](maintenance.md) before your first change.
- Read [Feature development guide](feature-development.md) when adding a user
  visible feature.
- Read [Frontend architecture](../architecture/frontend/architecture.md) for React changes.
- Read [Backend architecture](../architecture/backend/architecture.md) for API or persistence
  changes.

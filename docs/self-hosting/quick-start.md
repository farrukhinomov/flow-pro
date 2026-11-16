# Quick Start

Run FlowPro on your own machine to evaluate it. This starts the whole stack
with seeded demo data and development sign-in. It is not a public deployment;
for that, read [public deployment](public-deployment.md).

## Requirements

- A container runtime with Compose support: Docker Engine, Podman or any
  compatible desktop application.
- About 2 GB of free memory.

## Start

```bash
git clone https://github.com/farrukhinomov/flow-pro.git
cd flow-pro
docker compose up --build
```

Open <http://localhost:8088> and sign in with `founder@flowpro.local` and the
password `superadmin`.

The stack contains four services:

| Service | Role |
| --- | --- |
| `web` | Caddy. Serves the web app and proxies `/api` to the API. |
| `api` | The FlowPro HTTP API. Applies database migrations on start. |
| `worker` | Background jobs, such as dispatching the outbox. |
| `postgres` | PostgreSQL. All data lives in the `flowpro-postgres` volume. |

## Change the defaults

Copy `.env.example` to `.env` and edit it. For example, to serve the app on a
different port:

```bash
FLOWPRO_HTTP_PORT=9000
```

## Optional services

```bash
docker compose --profile tools up -d      # pgAdmin on http://localhost:5050
```

Mail the app sends, such as email confirmation and password reset links, is
caught by Mailpit. Read it at http://localhost:8025.

## Stop and reset

```bash
docker compose down        # stop, keep the data
docker compose down -v     # stop and delete all data
```

## Next steps

- [Public deployment](public-deployment.md)
- [Administration guide](admin-guide.md)
- [Backup and restore](backup-restore.md)

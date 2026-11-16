# Public Deployment

How to run FlowPro on a server that is reachable from the internet. The stack
is the same one as in the [quick start](quick-start.md), with
`compose.public.yaml` layered on top. That overlay removes every development
default: secrets and hostnames are required, development sign-in is off, and
no demo data is seeded unless you run the [public demo](#public-demo).

## Requirements

- A Linux server with a container runtime and Compose support. 2 vCPU and 4 GB
  of memory are enough for a small team.
- One DNS name pointing at the server, for example `flowpro.example.com`. The
  app, the API and sign-in are all served from it.
- Ports 80 and 443 open to the internet. Caddy uses them to obtain and renew
  TLS certificates from Let's Encrypt automatically.

No other port needs to be public. PostgreSQL and the API listen on the
internal container network only.

## Configure

Create `.env` next to `compose.yaml`. Use long random values for every
password.

```bash
FLOWPRO_DOMAIN=flowpro.example.com

FLOWPRO_POSTGRES_DB=flowpro
FLOWPRO_POSTGRES_USER=flowpro
FLOWPRO_POSTGRES_PASSWORD=<random>
# The PostgreSQL administrator (user "postgres"), used only for backups.
FLOWPRO_POSTGRES_ADMIN_PASSWORD=<random>

# Optional: set to false so people can only join by invitation.
FLOWPRO_REGISTRATION_ENABLED=true

# Mail for email confirmation and password reset.
FLOWPRO_EMAIL_FROM=no-reply@flowpro.example.com
FLOWPRO_SMTP_HOST=smtp.example.com
FLOWPRO_SMTP_PORT=587
FLOWPRO_SMTP_USERNAME=<user>
FLOWPRO_SMTP_PASSWORD=<password>
FLOWPRO_SMTP_SECURITY=StartTls
```

FlowPro connects to PostgreSQL as `FLOWPRO_POSTGRES_USER`, an ordinary role
that owns the FlowPro database. On first start the database container creates
it from `docker/postgres/initdb`. It is deliberately not a superuser:
PostgreSQL keeps workspaces apart with row-level security, and superusers skip
it. The API and the worker refuse to start on a role that is a superuser or
has `BYPASSRLS`. If you use a managed PostgreSQL instead of the container,
create such a role yourself and let it own the database.

Any SMTP server works: your mail host, a transactional mail service, or your
own Postfix. Set up SPF, DKIM and DMARC for the sender domain, or reset links
will land in spam. Without `FLOWPRO_SMTP_HOST` mail is off and people cannot
reset a forgotten password themselves.

Sign-in, account emails and registration are rate limited per client address:
10 sign-ins a minute, 5 account emails per 15 minutes and 5 registrations an
hour. If many people reach FlowPro from one public address, such as an office
behind one NAT, raise them with `FLOWPRO_RATE_LIMIT_SIGN_IN_PER_MINUTE`,
`FLOWPRO_RATE_LIMIT_ACCOUNT_EMAIL_PER_15_MINUTES` and
`FLOWPRO_RATE_LIMIT_REGISTRATIONS_PER_HOUR`. Account lockout still stops
password guessing against any single account.

FlowPro signs people in itself. Accounts and sessions live in PostgreSQL, so
there is no identity provider to run or secure separately.

Keep `.env` out of version control and readable only by the user that runs the
stack.

## Start

Use the published images. Add the version to `.env`:

```bash
FLOWPRO_VERSION=0.1.0
```

Then start the stack:

```bash
docker compose -f compose.yaml -f compose.public.yaml --env-file .env up -d
```

Images are published for amd64 and arm64 at
`ghcr.io/farrukhinomov/flow-pro-{api,worker,web,migrate}`. To build them from
source instead, add `--build`.

## Database migrations

The `migrate` service applies pending database migrations and exits. The API
and worker start only after it succeeds, so a failed migration stops an upgrade
instead of leaving a crashing API. Migrations are always backward-compatible
with the previous release, so the old version keeps working during an upgrade.

## Upgrade

Change `FLOWPRO_VERSION` in `.env`, then:

```bash
docker compose -f compose.yaml -f compose.public.yaml --env-file .env pull
docker compose -f compose.yaml -f compose.public.yaml --env-file .env up -d
```

To go back, set the previous version and run the same two commands.

## Oracle Cloud

[infra/README.md](../../infra/README.md) provisions a server on Oracle Cloud's
Always Free tier with OpenTofu, including nightly backups and a deploy account
for continuous deployment.

## Public demo

The same stack can run the public demo: one workspace, **FlowPro Demo**, with
a shared login per role (Admin, Manager, Employee) that visitors use with one
click from the sign-in page. Every night the worker wipes the whole database
and seeds the demo again.

The seed fills the workspace so there is something to look at: eight people
in two teams, each with a contract, the last two working weeks of time
bookings, and five absence requests. Two of them wait for the manager to
decide, two are approved and one is rejected. All dates are relative to
the reset, so the demo looks current on any day.

Run it on a server and database of its own, never next to real data. As a
safeguard the worker refuses to wipe a database that holds any other
workspace, and logs a critical error instead.

```bash
FLOWPRO_DEMO_MODE=true
# Shown on the sign-in page; at least 12 characters.
FLOWPRO_DEMO_PASSWORD=try flowpro today
# When the nightly wipe runs, in UTC.
FLOWPRO_DEMO_RESET_AT_UTC=03:00
# Required: visitors must not create accounts on a database that is wiped.
FLOWPRO_REGISTRATION_ENABLED=false
# Leave mail off, so the demo cannot be used to send email.
FLOWPRO_SMTP_HOST=
```

The API and the worker refuse to start with the demo on and registration on,
or with a short password.

What visitors cannot do, so no one can lock the others out until the next
reset:

- change a shared login's email, password or two-step sign-in, or sign out its
  other sessions (those are other visitors)
- lock a shared login with wrong passwords; the per-address rate limit still
  applies
- edit or deactivate the shared logins' memberships

Everything else, including the workspace's data and settings, is theirs to
try, and is gone by the next morning. The demo people are fictional and their
addresses use the reserved `.invalid` domain.

## Verify

```bash
curl -i https://flowpro.example.com/health/ready
```

Then open the app, register an account and complete the setup wizard.

## Operate

- Take backups before every upgrade: [backup and restore](backup-restore.md).
- Day-to-day administration: [administration guide](admin-guide.md).
- Rotate any secret that was copied into a log, a ticket or a chat.

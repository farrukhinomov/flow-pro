# Self-Hosted Admin Guide

This guide describes the minimum operational baseline for running FlowPro in a
self-hosted environment. It is intended for administrators, implementation
partners, and internal IT teams.

## Responsibilities

The self-hosted operator is responsible for:

- Infrastructure security, patching, and network access.
- PostgreSQL backups and tested restores.
- Object storage selection, licensing, retention, and backups.
- Account administration: lockouts, sessions and invitations.
- TLS certificates and public endpoint security.
- SMTP configuration for email notifications.
- Monitoring, alerting, and incident response.

FlowPro provides application-level controls, APIs, and documentation. It cannot
guarantee compliance if infrastructure operations are incomplete.

## Required Services

| Service | Purpose | Production guidance |
| --- | --- | --- |
| FlowPro API | Backend API and OpenAPI/Scalar | Run behind TLS reverse proxy. |
| FlowPro Worker | Outbox, notifications, background jobs | Run at least one worker per tenant environment. |
| PostgreSQL | Legal source of truth for users, bookings, requests, approvals, audits | Use managed PostgreSQL or a properly backed-up cluster. |
| Accounts and sessions (in PostgreSQL) | Authentication | Built into the API. Back up the database; there is no separate identity service. |
| Object storage | Attachments and exports | Prefer provider-managed S3-compatible storage for production. |
| SMTP/email provider | Email confirmation, password reset, notifications | Use a provider with SPF, DKIM, and DMARC configured. Without it, people cannot reset forgotten passwords. |

## Production Configuration Rules

- Do not use `Authentication:Mode=DevelopmentHeaders` outside Development.
- Do not use demo credentials in production.
- Do not expose PostgreSQL or internal admin ports to the public
  internet.
- Do not use object storage root credentials for FlowPro application access.
- Keep all secrets in environment variables, Docker secrets, Kubernetes
  secrets, or a secret manager. Do not commit secrets.
- Set `Database:ApplyMigrationsOnStartup=false` in production and run reviewed
  migrations during deployment.

## First Deployment Checklist

- Configure TLS and trusted hostnames.
- Sign in and verify `/api/v1/auth/session`.
- Create tenant, roles, permissions, users, employees, teams, departments, and
  locations.
- Configure work patterns, holiday calendar, attendance policy, approval
  workflows, and payroll export settings.
- Configure object storage and run an upload/download/delete smoke test.
- Configure SMTP, then use "Forgot password?" on the sign-in page and check
  that the reset email arrives and its link opens your domain.
- Run `bash scripts/backup.sh` and restore into a non-production environment.
- Verify audit events are written for bookings, requests, approvals,
  attachments, and admin changes.

## Ports

Default Docker Compose development ports:

| Port | Service |
| --- | --- |
| 8088 | FlowPro web app and API (Caddy) |
| 5123 | FlowPro API, direct |
| 5050 | pgAdmin |
| 8025 | Mailpit inbox (mail sent by the local stack) |
| 1025 | Mailpit SMTP |
| 5432 | PostgreSQL |

In production, expose only the public application endpoint (ports 80 and 443
on Caddy). Admin consoles should be private/VPN-only.

## Upgrade Process

1. Read release notes and migration notes.
2. Take a fresh backup.
3. Restore the backup into staging.
4. Run migrations in staging.
5. Run smoke tests for auth, attendance, requests, attachments, payroll export,
   and sync.
6. Deploy during a maintenance window.
7. Run production smoke tests and verify worker/outbox processing.

## Incident Response

For suspected data exposure or unauthorized access:

- Deactivate affected users in FlowPro. A deactivated membership is refused on
  its next request, whatever session it holds.
- Preserve audit logs and application logs.
- Rotate affected credentials.
- Snapshot the database and object storage metadata.
- Notify the responsible data protection/contact team.
- Follow contractual and legal breach notification timelines.

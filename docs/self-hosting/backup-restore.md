# Backup and Restore Guide

Backups are part of production readiness. A backup that has never been restored
is only a hopeful file.

FlowPro's legal source of truth is PostgreSQL. Attachment bytes and export files
live in object storage or local attachment storage, but their metadata and audit
trail live in PostgreSQL.

## What Must Be Backed Up

- PostgreSQL database.
- Attachment/object storage data.
- Data protection keys. The API encrypts the secrets of people who use
  two-step sign-in with them; without them those people cannot sign in.
  Together with the database they decrypt those secrets, so store backups
  encrypted and as confidential as the database.
- Environment configuration, excluding plaintext sharing of secrets.
- Deployment manifests and release version.

## Current Scripts

Run from `apps/api`:

```bash
FLOWPRO_ENV_FILE=.env \
FLOWPRO_BACKUP_DIR=./backups \
bash scripts/backup.sh
```

Restore is gated intentionally:

```bash
FLOWPRO_ENV_FILE=.env \
FLOWPRO_RESTORE_CONFIRM=I_UNDERSTAND \
bash scripts/restore.sh ./backups/20260605T120000Z
```

The scripts produce `SHA256SUMS` so operators can verify backup integrity before
and after transfer.

Backups run as the PostgreSQL administrator (`postgres`), because tenant
isolation hides every workspace's rows from FlowPro's own role. A restore loads
the data as FlowPro's role, so it owns every object again; that role may bypass
row-level security only while the restore runs, and the API refuses to start
if it still can.

## Production Schedule

Minimum recommendation:

- PostgreSQL: daily full backup plus point-in-time recovery where available.
- Attachments: daily object backup or provider-level replication.
- Restore test: monthly for production-like data volume.
- Retention: align with contract, payroll, and GDPR requirements.

## Restore Order

1. Stop API and worker traffic.
2. Confirm the target environment. Never restore production data into an
   unsecured environment.
3. Restore PostgreSQL.
4. Restore object storage/attachments.
5. Restore data protection keys (`scripts/restore.sh` does this when the
   backup has them).
6. Start, or restart, API and worker.
7. Run smoke tests.
8. Verify audit events and latest sync cursor.

## Smoke Tests After Restore

- Sign-in and `/api/v1/auth/session`. Accounts and sessions are in the
  database, so they come back with it.
- Today page attendance read.
- Clock-in and clock-out in a test tenant.
- Request create/approve/reject.
- Attachment upload/download/delete.
- Payroll export creation/download.
- Sync feed reads from the latest known cursor.
- Worker outbox processing.

## Security

- Encrypt backups at rest.
- Restrict backup access to administrators who need it.
- Do not store backups on the same disk as the primary database only.
- Do not include backup credentials in the backup archive.
- Log restore operations and require approval for production restores.

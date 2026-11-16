#!/usr/bin/env bash
# Nightly backup: dumps the FlowPro database and copies the API's data protection keys,
# and uploads both to Object Storage.
# Installed as /usr/local/bin/flowpro-backup and run by a systemd timer.
# The server authenticates as itself (instance principal); the bucket deletes
# old backups through its own lifecycle rule.
set -Eeuo pipefail

APP_DIR="${FLOWPRO_APP_DIR:-/opt/flowpro}"
BUCKET="${FLOWPRO_BACKUP_BUCKET:?Set FLOWPRO_BACKUP_BUCKET}"
NAMESPACE="${FLOWPRO_BACKUP_NAMESPACE:?Set FLOWPRO_BACKUP_NAMESPACE}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

cd "${APP_DIR}"
# shellcheck disable=SC1091
set -a && . ./.env && set +a

compose=(docker compose -f compose.yaml -f compose.public.yaml --env-file .env --env-file .deploy.env)
dump="${WORK_DIR}/flowpro-${STAMP}.dump"

# As the administrator: tenant isolation hides every workspace's rows from
# FlowPro's own role, and pg_dump refuses to dump them.
"${compose[@]}" exec -T postgres \
  pg_dump --format=custom --no-owner \
  --username postgres "${FLOWPRO_POSTGRES_DB}" > "${dump}"

# An empty or truncated dump must fail the job, not be uploaded.
if [[ "$(stat --format=%s "${dump}")" -lt 1024 ]]; then
  echo "Backup is suspiciously small; not uploading." >&2
  exit 1
fi

oci os object put \
  --auth instance_principal \
  --namespace "${NAMESPACE}" \
  --bucket-name "${BUCKET}" \
  --file "${dump}" \
  --name "database/flowpro-${STAMP}.dump" \
  --no-overwrite

echo "Uploaded database/flowpro-${STAMP}.dump"

# Without these keys the API cannot decrypt the secrets of people who use two-step sign-in.
keys="${WORK_DIR}/dataprotection-keys-${STAMP}.tar.gz"
"${compose[@]}" exec -T api \
  tar -C /var/lib/flowpro -czf - dataprotection-keys > "${keys}"

oci os object put \
  --auth instance_principal \
  --namespace "${NAMESPACE}" \
  --bucket-name "${BUCKET}" \
  --file "${keys}" \
  --name "dataprotection-keys/dataprotection-keys-${STAMP}.tar.gz" \
  --no-overwrite

echo "Uploaded dataprotection-keys/dataprotection-keys-${STAMP}.tar.gz"

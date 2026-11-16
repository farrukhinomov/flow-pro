#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${FLOWPRO_COMPOSE_FILE:-compose.yaml}"
ENV_FILE="${FLOWPRO_ENV_FILE:-}"
BACKUP_ROOT="${FLOWPRO_BACKUP_DIR:-${REPO_DIR}/backups}"
POSTGRES_SERVICE="${FLOWPRO_POSTGRES_SERVICE:-postgres}"
API_SERVICE="${FLOWPRO_API_SERVICE:-api}"
POSTGRES_DB="${FLOWPRO_POSTGRES_DB:-flowpro}"
# The administrator, not FlowPro's own role: tenant isolation hides every
# workspace's rows from FlowPro's role, and pg_dump refuses to dump them.
POSTGRES_ADMIN_USER="${FLOWPRO_POSTGRES_ADMIN_USER:-postgres}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_DIR="${BACKUP_ROOT%/}/${TIMESTAMP}"

compose_args=(-f "${COMPOSE_FILE}")
if [[ -n "${ENV_FILE}" ]]; then
  compose_args=(--env-file "${ENV_FILE}" "${compose_args[@]}")
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command '$1' was not found." >&2
    exit 1
  fi
}

checksum_write() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@"
    return
  fi

  require_command shasum
  shasum -a 256 "$@"
}

write_manifest() {
  cat >"${BACKUP_DIR}/manifest.json" <<EOF
{
  "createdAt": "${TIMESTAMP}",
  "database": "${POSTGRES_DB}",
  "postgresService": "${POSTGRES_SERVICE}",
  "apiService": "${API_SERVICE}",
  "files": {
    "database": "postgres.dump",
    "attachments": "attachments.tar.gz",
    "dataProtectionKeys": "dataprotection-keys.tar.gz",
    "checksums": "SHA256SUMS"
  }
}
EOF
}

require_command docker

mkdir -p "${BACKUP_DIR}"

(
  cd "${REPO_DIR}"

  echo "Creating PostgreSQL backup..."
  docker compose "${compose_args[@]}" exec -T "${POSTGRES_SERVICE}" \
    pg_dump --format=custom --no-owner --no-acl \
      --username="${POSTGRES_ADMIN_USER}" \
      --dbname="${POSTGRES_DB}" \
    >"${BACKUP_DIR}/postgres.dump"

  echo "Creating attachment backup..."
  docker compose "${compose_args[@]}" exec -T "${API_SERVICE}" \
    tar -C /var/lib/flowpro -czf - attachments \
    >"${BACKUP_DIR}/attachments.tar.gz"

  # Without these keys the API cannot decrypt what it protected, such as the secrets of
  # people who use two-step sign-in. Anyone holding them and the database can, so keep the
  # backup as confidential as the database itself.
  echo "Creating data protection key backup..."
  docker compose "${compose_args[@]}" exec -T "${API_SERVICE}" \
    tar -C /var/lib/flowpro -czf - dataprotection-keys \
    >"${BACKUP_DIR}/dataprotection-keys.tar.gz"
)

write_manifest
(
  cd "${BACKUP_DIR}"
  checksum_write postgres.dump attachments.tar.gz dataprotection-keys.tar.gz manifest.json >SHA256SUMS
)

echo "Backup created at ${BACKUP_DIR}"

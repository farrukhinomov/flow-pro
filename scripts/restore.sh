#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${FLOWPRO_COMPOSE_FILE:-compose.yaml}"
ENV_FILE="${FLOWPRO_ENV_FILE:-}"
POSTGRES_SERVICE="${FLOWPRO_POSTGRES_SERVICE:-postgres}"
API_SERVICE="${FLOWPRO_API_SERVICE:-api}"
POSTGRES_DB="${FLOWPRO_POSTGRES_DB:-flowpro}"
POSTGRES_USER="${FLOWPRO_POSTGRES_USER:-flowpro}"
POSTGRES_ADMIN_USER="${FLOWPRO_POSTGRES_ADMIN_USER:-postgres}"
BACKUP_DIR="${1:-}"

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

checksum_check() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum --check SHA256SUMS
    return
  fi

  require_command shasum
  shasum -a 256 -c SHA256SUMS
}

usage() {
  cat >&2 <<EOF
Usage:
  FLOWPRO_RESTORE_CONFIRM=I_UNDERSTAND bash scripts/restore.sh <backup-directory>

The backup directory must contain:
  - postgres.dump
  - attachments.tar.gz
  - SHA256SUMS
and, from backups made since data protection keys are included:
  - dataprotection-keys.tar.gz

Stop API and worker traffic before restoring production data.
EOF
}

if [[ -z "${BACKUP_DIR}" ]]; then
  usage
  exit 2
fi

if [[ "${FLOWPRO_RESTORE_CONFIRM:-}" != "I_UNDERSTAND" ]]; then
  echo "Refusing to restore without FLOWPRO_RESTORE_CONFIRM=I_UNDERSTAND." >&2
  usage
  exit 2
fi

require_command docker

BACKUP_DIR="$(cd -- "${BACKUP_DIR}" && pwd)"
for file in postgres.dump attachments.tar.gz SHA256SUMS; do
  if [[ ! -f "${BACKUP_DIR}/${file}" ]]; then
    echo "Missing required backup file: ${BACKUP_DIR}/${file}" >&2
    exit 1
  fi
done

(
  cd "${BACKUP_DIR}"
  checksum_check
)

(
  cd "${REPO_DIR}"

  set_bypass_rls() {
    docker compose "${compose_args[@]}" exec -T "${POSTGRES_SERVICE}" \
      psql --set=ON_ERROR_STOP=1 --username="${POSTGRES_ADMIN_USER}" --dbname=postgres \
        --command="ALTER ROLE \"${POSTGRES_USER}\" $1"
  }

  # Restored as FlowPro's own role, so it owns every object again. Loading
  # rows into tables under forced row-level security needs BYPASSRLS, which the
  # role gets only for the restore; the API refuses to start while it has it.
  echo "Restoring PostgreSQL backup..."
  set_bypass_rls BYPASSRLS
  trap 'set_bypass_rls NOBYPASSRLS' EXIT
  docker compose "${compose_args[@]}" exec -T "${POSTGRES_SERVICE}" \
    pg_restore --clean --if-exists --no-owner --no-acl \
      --username="${POSTGRES_ADMIN_USER}" \
      --role="${POSTGRES_USER}" \
      --dbname="${POSTGRES_DB}" \
    <"${BACKUP_DIR}/postgres.dump"

  echo "Restoring attachment backup..."
  docker compose "${compose_args[@]}" exec -T "${API_SERVICE}" \
    sh -c 'rm -rf /var/lib/flowpro/attachments && mkdir -p /var/lib/flowpro'
  docker compose "${compose_args[@]}" exec -T "${API_SERVICE}" \
    tar -C /var/lib/flowpro -xzf - \
    <"${BACKUP_DIR}/attachments.tar.gz"

  if [[ -f "${BACKUP_DIR}/dataprotection-keys.tar.gz" ]]; then
    echo "Restoring data protection keys..."
    docker compose "${compose_args[@]}" exec -T "${API_SERVICE}" \
      sh -c 'rm -rf /var/lib/flowpro/dataprotection-keys && mkdir -p /var/lib/flowpro'
    docker compose "${compose_args[@]}" exec -T "${API_SERVICE}" \
      tar -C /var/lib/flowpro -xzf - \
      <"${BACKUP_DIR}/dataprotection-keys.tar.gz"
  else
    echo "This backup has no data protection keys; the current ones stay." >&2
  fi
)

# The API reads its keys at startup.
echo "Restart the API so it loads the restored keys."

echo "Restore completed from ${BACKUP_DIR}"

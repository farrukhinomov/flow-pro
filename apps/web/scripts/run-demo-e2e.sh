#!/usr/bin/env bash

# Runs the public demo e2e suite against databases of its own:
#
# 1. Safety: the worker, with the demo on, must refuse to wipe a database that holds another
#    workspace (here the development seed).
# 2. The demo itself: the worker seeds an empty database, the API serves the shared logins, and the
#    nightly reset is scheduled a minute or two ahead so the suite can watch it wipe and reseed.

set -euo pipefail

SERVER_DIR="../api"
API_PROJECT="${SERVER_DIR}/src/FlowPro.Api/FlowPro.Api.csproj"
WORKER_PROJECT="${SERVER_DIR}/src/FlowPro.Worker/FlowPro.Worker.csproj"
FLOWPRO_E2E_API_PORT="${FLOWPRO_E2E_API_PORT:-5126}"
FLOWPRO_E2E_API_ORIGIN="http://127.0.0.1:${FLOWPRO_E2E_API_PORT}"
FLOWPRO_E2E_WEB_PORT="${FLOWPRO_E2E_WEB_PORT:-5176}"
FLOWPRO_E2E_BASE_URL="http://127.0.0.1:${FLOWPRO_E2E_WEB_PORT}"
LOG_DIR="${TMPDIR:-/tmp}"
GUARD_API_LOG="${LOG_DIR}/flowpro-demo-e2e-guard-api.log"
GUARD_WORKER_LOG="${LOG_DIR}/flowpro-demo-e2e-guard-worker.log"
API_LOG="${LOG_DIR}/flowpro-demo-e2e-api.log"
WORKER_LOG="${LOG_DIR}/flowpro-demo-e2e-worker.log"
DEMO_PASSWORD="public demo e2e password"

connection() {
  echo "Host=127.0.0.1;Port=5432;Database=$1;Username=${FLOWPRO_POSTGRES_USER:-flowpro};Password=${FLOWPRO_POSTGRES_PASSWORD:-superadmin}"
}

PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do
    kill "${pid}" 2>/dev/null || true
    wait "${pid}" 2>/dev/null || true
  done
}
trap cleanup EXIT

wait_for_api() {
  local log="$1"
  for _ in {1..90}; do
    if curl --fail --silent "${FLOWPRO_E2E_API_ORIGIN}/health/ready" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  cat "${log}"
  echo "FlowPro API did not become ready within 90 seconds." >&2
  return 1
}

stop() {
  kill "$1" 2>/dev/null || true
  wait "$1" 2>/dev/null || true
}

FLOWPRO_POSTGRES_DB="${FLOWPRO_POSTGRES_DB:-flowpro}" \
FLOWPRO_POSTGRES_PASSWORD="${FLOWPRO_POSTGRES_PASSWORD:-superadmin}" \
FLOWPRO_POSTGRES_USER="${FLOWPRO_POSTGRES_USER:-flowpro}" \
  docker compose -f "../../compose.yaml" up -d postgres

dotnet build "${API_PROJECT}" --configuration Release --nologo
dotnet build "${WORKER_PROJECT}" --configuration Release --nologo

echo "== 1. The demo refuses a database that holds another workspace"
: >"${GUARD_API_LOG}"
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="${FLOWPRO_E2E_API_ORIGIN}" \
ConnectionStrings__FlowPro="$(connection flowpro_demo_guard_e2e)" \
Database__ApplyMigrationsOnStartup=true \
Database__SeedDevelopmentData=true \
dotnet run --project "${API_PROJECT}" --configuration Release --no-launch-profile --no-build \
  >"${GUARD_API_LOG}" 2>&1 &
guard_api=$!
PIDS+=("${guard_api}")
wait_for_api "${GUARD_API_LOG}"
stop "${guard_api}"

: >"${GUARD_WORKER_LOG}"
DOTNET_ENVIRONMENT=Development \
ConnectionStrings__FlowPro="$(connection flowpro_demo_guard_e2e)" \
Authentication__Session__RegistrationEnabled=false \
Demo__Enabled=true \
Demo__Password="${DEMO_PASSWORD}" \
dotnet run --project "${WORKER_PROJECT}" --configuration Release --no-launch-profile --no-build \
  >"${GUARD_WORKER_LOG}" 2>&1 &
guard_worker=$!
PIDS+=("${guard_worker}")

refused=false
for _ in {1..60}; do
  if grep -q "holds other workspaces" "${GUARD_WORKER_LOG}"; then
    refused=true
    break
  fi
  sleep 1
done
stop "${guard_worker}"

if [[ "${refused}" != true ]] || grep -q "wiped and seeded" "${GUARD_WORKER_LOG}"; then
  cat "${GUARD_WORKER_LOG}"
  echo "The demo did not refuse a database holding another workspace." >&2
  exit 1
fi
echo "Refused, as it must."

echo "== 2. The demo"
# Migrations first, with demo off, so the worker finds the schema.
: >"${API_LOG}"
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="${FLOWPRO_E2E_API_ORIGIN}" \
ConnectionStrings__FlowPro="$(connection flowpro_demo_e2e)" \
Authentication__Mode=Session \
Authentication__Session__RegistrationEnabled=false \
Database__ApplyMigrationsOnStartup=true \
Database__SeedDevelopmentData=false \
Demo__Enabled=true \
Demo__Password="${DEMO_PASSWORD}" \
RateLimiting__SignInPerMinute=200 \
dotnet run --project "${API_PROJECT}" --configuration Release --no-launch-profile --no-build \
  >"${API_LOG}" 2>&1 &
PIDS+=("$!")
wait_for_api "${API_LOG}"

# The nightly reset, due within the next one to two minutes, so the suite sees it happen.
RESET_AT="$(date -u -d '+2 minutes' +%H:%M)"
: >"${WORKER_LOG}"
DOTNET_ENVIRONMENT=Development \
ConnectionStrings__FlowPro="$(connection flowpro_demo_e2e)" \
Authentication__Session__RegistrationEnabled=false \
Demo__Enabled=true \
Demo__Password="${DEMO_PASSWORD}" \
Demo__ResetAtUtc="${RESET_AT}" \
dotnet run --project "${WORKER_PROJECT}" --configuration Release --no-launch-profile --no-build \
  >"${WORKER_LOG}" 2>&1 &
PIDS+=("$!")

export FLOWPRO_E2E_BASE_URL FLOWPRO_E2E_DEMO_PASSWORD="${DEMO_PASSWORD}"

FLOWPRO_API_PROXY_TARGET="${FLOWPRO_E2E_API_ORIGIN}" \
VITE_FLOWPRO_API_BASE_URL=/api/v1 \
VITE_FLOWPRO_AUTH_MODE=session \
VITE_FLOWPRO_REGISTRATION_ENABLED=false \
VITE_FLOWPRO_DEMO_MODE=true \
VITE_FLOWPRO_DEV_HEADER_AUTH=false \
VITE_FLOWPRO_ENABLE_DEVTOOLS=false \
FLOWPRO_E2E_REUSE_SERVER=false \
npm run test:e2e:ui -- --project=demo "$@"

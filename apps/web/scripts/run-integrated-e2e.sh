#!/usr/bin/env bash

set -euo pipefail

SERVER_DIR="../api"
FLOWPRO_E2E_API_PORT="${FLOWPRO_E2E_API_PORT:-5124}"
FLOWPRO_E2E_API_ORIGIN="${FLOWPRO_E2E_API_ORIGIN:-http://127.0.0.1:${FLOWPRO_E2E_API_PORT}}"
FLOWPRO_E2E_API_BASE_URL="${FLOWPRO_E2E_API_BASE_URL:-${FLOWPRO_E2E_API_ORIGIN}/api/v1}"
FLOWPRO_E2E_WEB_PORT="${FLOWPRO_E2E_WEB_PORT:-5174}"
FLOWPRO_E2E_BASE_URL="${FLOWPRO_E2E_BASE_URL:-http://127.0.0.1:${FLOWPRO_E2E_WEB_PORT}}"
API_LOG="${TMPDIR:-/tmp}/flowpro-api-e2e-${FLOWPRO_E2E_API_PORT}.log"
API_PROJECT="${SERVER_DIR}/src/FlowPro.Api/FlowPro.Api.csproj"

require_free_port() {
  local port="$1"
  local name="$2"

  if command -v lsof >/dev/null 2>&1 && lsof -ti ":${port}" >/dev/null 2>&1; then
    echo "Port ${port} is already in use; stop the existing ${name} process or set FLOWPRO_E2E_${name}_PORT." >&2
    exit 1
  fi
}

require_free_port "${FLOWPRO_E2E_API_PORT}" "API"
require_free_port "${FLOWPRO_E2E_WEB_PORT}" "WEB"
: >"${API_LOG}"

FLOWPRO_POSTGRES_DB="${FLOWPRO_POSTGRES_DB:-flowpro}" \
FLOWPRO_POSTGRES_PASSWORD="${FLOWPRO_POSTGRES_PASSWORD:-superadmin}" \
FLOWPRO_POSTGRES_USER="${FLOWPRO_POSTGRES_USER:-flowpro}" \
  docker compose -f "../../compose.yaml" up -d postgres

dotnet build "${API_PROJECT}" --configuration Release --nologo

ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="${FLOWPRO_E2E_API_ORIGIN}" \
Authentication__Mode=DevelopmentHeaders \
Cors__AllowedOrigins__0="${FLOWPRO_E2E_BASE_URL}" \
Database__ApplyMigrationsOnStartup=true \
Database__SeedDevelopmentData=true \
dotnet run \
  --project "${API_PROJECT}" \
  --configuration Release \
  --no-launch-profile \
  --no-build >"${API_LOG}" 2>&1 &
API_PID=$!

cleanup() {
  kill "${API_PID}" 2>/dev/null || true
  wait "${API_PID}" 2>/dev/null || true
}
trap cleanup EXIT

# Playwright reads these from its environment.
export FLOWPRO_E2E_API_BASE_URL FLOWPRO_E2E_BASE_URL

for _ in {1..60}; do
  if curl --fail --silent "${FLOWPRO_E2E_API_ORIGIN}/health/ready" >/dev/null 2>&1; then
    VITE_FLOWPRO_API_BASE_URL="${FLOWPRO_E2E_API_BASE_URL}" \
    VITE_FLOWPRO_AUTH_MODE=local \
    VITE_FLOWPRO_DEV_HEADER_AUTH=true \
    VITE_FLOWPRO_DEV_TENANT_ID="${VITE_FLOWPRO_DEV_TENANT_ID:-01975fa8-7590-7000-8000-000000000001}" \
    VITE_FLOWPRO_DEV_USER_ID="${VITE_FLOWPRO_DEV_USER_ID:-01975fa8-7590-7000-8000-000000000002}" \
    VITE_FLOWPRO_DEV_WORKER_USER_ID="${VITE_FLOWPRO_DEV_WORKER_USER_ID:-01975fa8-7590-7000-8000-000000000010}" \
    VITE_FLOWPRO_ENABLE_DEVTOOLS=false \
    FLOWPRO_E2E_REUSE_SERVER=false \
    npm run test:e2e:ui -- "$@"
    exit 0
  fi

  if ! kill -0 "${API_PID}" 2>/dev/null; then
    cat "${API_LOG}"
    exit 1
  fi

  sleep 1
done

cat "${API_LOG}"
echo "FlowPro API did not become ready within 60 seconds." >&2
exit 1

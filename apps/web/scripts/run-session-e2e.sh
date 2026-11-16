#!/usr/bin/env bash

# Runs the session e2e suite: the real sign-in path with an HttpOnly session cookie, email links
# caught by Mailpit, and the web app and API on one origin through the Vite proxy, the same shape
# as the production reverse proxy.

set -euo pipefail

SERVER_DIR="../api"
FLOWPRO_E2E_API_PORT="${FLOWPRO_E2E_API_PORT:-5125}"
FLOWPRO_E2E_API_ORIGIN="${FLOWPRO_E2E_API_ORIGIN:-http://127.0.0.1:${FLOWPRO_E2E_API_PORT}}"
FLOWPRO_E2E_WEB_PORT="${FLOWPRO_E2E_WEB_PORT:-5175}"
FLOWPRO_E2E_BASE_URL="${FLOWPRO_E2E_BASE_URL:-http://127.0.0.1:${FLOWPRO_E2E_WEB_PORT}}"
FLOWPRO_E2E_MAILPIT_URL="${FLOWPRO_E2E_MAILPIT_URL:-http://127.0.0.1:8025}"
API_LOG="${TMPDIR:-/tmp}/flowpro-api-session-e2e-${FLOWPRO_E2E_API_PORT}.log"
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
  docker compose -f "../../compose.yaml" up -d postgres mailpit

dotnet build "${API_PROJECT}" --configuration Release --nologo

# The suite signs in, registers and requests emails far more often than one person would, all
# from one address, so it raises the per-address budgets. The limits themselves stay on.
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="${FLOWPRO_E2E_API_ORIGIN}" \
Authentication__Mode=Session \
Authentication__Email__AppBaseUrl="${FLOWPRO_E2E_BASE_URL}/" \
Database__ApplyMigrationsOnStartup=true \
Database__SeedDevelopmentData=true \
Database__DevelopmentAccountPassword=superadmin \
Email__Smtp__Host=127.0.0.1 \
Email__Smtp__Port=1025 \
Email__Smtp__Security=None \
RateLimiting__SignInPerMinute=200 \
RateLimiting__AccountEmailPer15Minutes=100 \
RateLimiting__RegistrationsPerHour=100 \
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
export FLOWPRO_E2E_BASE_URL FLOWPRO_E2E_MAILPIT_URL

for _ in {1..60}; do
  if curl --fail --silent "${FLOWPRO_E2E_API_ORIGIN}/health/ready" >/dev/null 2>&1; then
    FLOWPRO_API_PROXY_TARGET="${FLOWPRO_E2E_API_ORIGIN}" \
    VITE_FLOWPRO_API_BASE_URL=/api/v1 \
    VITE_FLOWPRO_AUTH_MODE=session \
    VITE_FLOWPRO_DEV_HEADER_AUTH=false \
    VITE_FLOWPRO_ENABLE_DEVTOOLS=false \
    FLOWPRO_E2E_REUSE_SERVER=false \
    npm run test:e2e:ui -- --project=session "$@"
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

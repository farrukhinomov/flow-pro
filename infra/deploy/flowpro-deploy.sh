#!/usr/bin/env bash
# Deploys one FlowPro version on this server.
#
# Installed as /usr/local/bin/flowpro-deploy and bound as the forced command of
# the deploy user's SSH key, so that key can do nothing else. The only input is
# the image tag, passed as the SSH command:
#
#   ssh deploy@server sha-<40 hex characters>
#   ssh deploy@server 1.4.2
#
# Steps: check out the matching compose files, pull the images, apply database
# migrations, then restart the services. A failed migration stops the deploy
# and leaves the previous version running.
set -Eeuo pipefail

APP_DIR="${FLOWPRO_APP_DIR:-/opt/flowpro}"
VERSION="${SSH_ORIGINAL_COMMAND:-${1:-}}"

if [[ ! "${VERSION}" =~ ^(sha-[0-9a-f]{40}|[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "Refusing to deploy: '${VERSION}' is not sha-<commit> or <major>.<minor>.<patch>." >&2
  exit 2
fi

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing ${APP_DIR}/.env. See docs/self-hosting/public-deployment.md." >&2
  exit 1
fi

# One deploy at a time.
exec 9>"${APP_DIR}/.deploy.lock"
if ! flock --nonblock 9; then
  echo "Another deploy is running." >&2
  exit 1
fi

# The compose files must match the images being deployed.
if [[ "${VERSION}" == sha-* ]]; then
  git_ref="${VERSION#sha-}"
else
  git_ref="v${VERSION}"
fi
git fetch --quiet --tags origin
git checkout --quiet --detach "${git_ref}"

compose=(docker compose -f compose.yaml -f compose.public.yaml --env-file .env --env-file .deploy.env)
previous="$(cat .deploy.env 2>/dev/null || true)"
printf 'FLOWPRO_VERSION=%s\n' "${VERSION}" > .deploy.env

rollback_marker() {
  if [[ -n "${previous}" ]]; then
    printf '%s\n' "${previous}" > .deploy.env
  fi
}

echo "Pulling images for ${VERSION}"
if ! "${compose[@]}" pull --quiet migrate api worker web; then
  rollback_marker
  echo "Pull failed; the running version is unchanged." >&2
  exit 1
fi

echo "Applying database migrations"
if ! "${compose[@]}" run --rm migrate; then
  rollback_marker
  echo "Migration failed; the running version is unchanged." >&2
  exit 1
fi

echo "Starting ${VERSION}"
"${compose[@]}" up --detach --no-build --remove-orphans
docker image prune --force --filter "until=168h" >/dev/null

echo "Deployed ${VERSION}"

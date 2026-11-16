# Build context: the repository root.
FROM node:22-alpine AS build
WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY apps/web ./

# No deployment-specific values are built in: the image serves /config.js from
# its environment at runtime (see docker/Caddyfile).
# The npm build script wraps these in a Node version switcher that expects the
# repository root; the base image already pins Node.
RUN npx tsc -b && npx vite build

FROM caddy:2-alpine AS final

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80 443 443/udp

# syntax=docker/dockerfile:1
# Server-side images. Build from the REPO ROOT (compose.prod.yml does this for you):
#   docker build -f apps/api/Dockerfile --target api     -t freutransfer-api .
#   docker build -f apps/api/Dockerfile --target migrate -t freutransfer-migrate .
#
# Two images, because the Prisma CLI (needed only to change the schema) brings ~230 MB of tools
# (Studio, an embedded Postgres for `prisma dev`, ...) that the running API never uses:
# - migrate: the db package with the Prisma CLI; applies new migrations, then exits
# - api:     the Express API with production dependencies only (no pnpm, no CLI, no caches);
#            the same image loads the reviewed provider data (`seed` in compose.prod.yml) and
#            runs the hourly collector (`collect`, ADR 0007)
# Node runs our TypeScript directly (type stripping), so nothing is compiled.

# Node version = .node-version (deploy/versions.test.ts keeps them equal).
# Debian slim, not alpine: Prisma's schema engine ships prebuilt for glibc.
FROM node:26.13.0-trixie-slim AS base
WORKDIR /app
# pnpm: Node 25+ no longer ships corepack, so install it with npm, at the exact version
# package.json's "packageManager" names ("pnpm@12.16.1"): one source for the version.
COPY package.json ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')" && npm cache clean --force
# Manifests before sources: Docker reuses the slow install steps from cache until one of these
# changes. Every workspace's package.json comes, so the install sees the same workspace as the
# lockfile (add a line here for each new package).
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/collectors/package.json packages/collectors/

# ── migrate ─────────────────────────────────────────────────────────────────────
FROM base AS db-deploy
# `pnpm deploy`: the db package alone, with its own dependencies (the Prisma CLI is a dev
# dependency). A filtered `pnpm install` would also bring the root's Biome, TypeScript, Vitest and
# knip (~200 MB). --legacy: copy the workspace package `core` in as is (pnpm 10+ otherwise
# requires the inject-workspace-packages setting). The cache mount keeps pnpm's store out of
# the image. Prisma's install script warns that Node 26 is unsupported; its package.json says
# "node": ">=24.0" (checked 2026-11-11), so the warning is outdated.
# Known and accepted: db's other dev dependency (Testcontainers, with two moderate
# `pnpm audit` findings in its glob/minimatch) comes along; nothing in this image ever runs it.
RUN --mount=type=cache,id=pnpm,target=/root/.cache/pnpm \
  pnpm --filter @freu-transfer/db deploy --legacy --store-dir /root/.cache/pnpm/store /db
COPY packages/db/prisma /db/prisma
COPY packages/db/prisma.config.ts /db/
# prisma.config.ts imports it (the local fallback URL; production always sets DATABASE_URL).
COPY packages/db/src/local-dev.ts /db/src/
RUN cd /db && node_modules/.bin/prisma generate

FROM node:26.13.0-trixie-slim AS migrate
WORKDIR /db
COPY --from=db-deploy /db ./
ENV NODE_ENV=production
# SECURITY: run as the unprivileged "node" user from the base image, never root.
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ── api (the default target) ────────────────────────────────────────────────────
FROM base AS api-deps
# "api..." = the API and the workspace packages it uses (core, db); "collectors..." = the
# collector and the same packages. Production dependencies only.
RUN --mount=type=cache,id=pnpm,target=/root/.cache/pnpm \
  pnpm install --frozen-lockfile --prod --filter "@freu-transfer/api..." \
    --filter "@freu-transfer/collectors..." --store-dir /root/.cache/pnpm/store

FROM node:26.13.0-trixie-slim AS api
WORKDIR /app
COPY --from=api-deps /app ./
COPY packages/core/src packages/core/src
COPY packages/db/src packages/db/src
COPY --from=db-deploy /db/src/generated packages/db/src/generated
COPY apps/api/src apps/api/src
COPY packages/collectors/src packages/collectors/src
# The reviewed provider data that the seed loads (packages/db/src/seed-cli.ts).
COPY data/manual data/manual
ENV NODE_ENV=production
USER node
EXPOSE 3000
# The slim image has no curl: ask /health with Node's built-in fetch. A long-running service
# with another command in this image (`collect`) must switch it off in compose.prod.yml, or it
# counts as unhealthy and `up --wait` (scripts/deploy.sh) fails.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/api/src/main.ts"]

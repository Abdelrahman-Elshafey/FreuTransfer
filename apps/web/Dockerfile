# syntax=docker/dockerfile:1
# Production image for the page. Build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t freutransfer-web .
# Stage 1 runs `vite build` with Node; stage 2 is nginx with the built files and the routing
# (apps/web/nginx.conf). The final image has no Node, no node_modules, no source code.

# Node version = .node-version (deploy/versions.test.ts keeps them equal).
FROM node:26.13.0-trixie-slim AS build
WORKDIR /app
# pnpm at the version package.json's "packageManager" names (see apps/api/Dockerfile).
COPY package.json ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')" && npm cache clean --force
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
# Only the page's own dependencies: from the API it imports just src/contract.ts, whose one import
# from core is a type (erased by the build), so the API's server libraries are not installed.
RUN --mount=type=cache,id=pnpm,target=/root/.cache/pnpm \
  pnpm install --frozen-lockfile --filter @freu-transfer/web --store-dir /root/.cache/pnpm/store
COPY tsconfig.base.json ./
COPY apps/api/src/contract.ts apps/api/src/
COPY apps/web apps/web
RUN pnpm --filter @freu-transfer/web build

# SECURITY: the "unprivileged" nginx image runs as a normal user (not root) and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/"]

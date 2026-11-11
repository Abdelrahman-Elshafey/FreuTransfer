# ADR 0006: Releases, deploys and backups

- **Status:** accepted (decisions by the owner, 2026-11-10; built in stage 3e)
- **Date:** 2026-11-11

## Context
ADR 0002 runs production on the OVH VPS with Docker Compose and leaves open how new versions get
there and where backups go. The server also runs UrConnections, which already deploys with images
from GitHub's registry (GHCR) and keeps off-site backups in Cloudflare R2.

## Decision
- **Place on the server:** its own folder `~/apps/freutransfer`, same Linux user, its own Compose
  project (`freutransfer-prod`), network and volumes. A separate Linux user adds little here: anyone
  who may run Docker is effectively root on the server.
- **Images:** built by CI, never on a laptop or on the server, and tagged with the **commit id**, so
  the running version is always known and a rollback is "run the previous id". Three images from
  two Dockerfiles: `api`, `migrate` (the Prisma CLI, kept out of the API image: ~230 MB of tools the
  running API never uses) and `web` (nginx with the built page). Public on GHCR, so the server pulls
  them without a password.
- **Deploys:** the first by hand from `docs/deploy.md`, to see and check every step. Then automated
  (stage 3e-2): a merge to `main` builds the images, and a deploy job runs on the server over SSH
  after the owner approves it (a protected GitHub environment). The SSH key may run only the deploy
  script (forced command), as for UrConnections.
- **Every start** runs `migrate` (schema) and `seed` (verified provider data from git) before the API,
  so a data change reaches production with the next deploy.
- **Backups** (stage 3e-4): a nightly `pg_dump` kept a few days on the server, copied to
  **Cloudflare R2** in a bucket and key of FreuTransfer's own (not UrConnections'), and a restore test.

## Alternatives considered
- **Deploy by hand only:** fine for one release, error-prone when repeated.
- **The server pulls new images by itself** (an updater container): no key in GitHub, but harder to
  see what runs and to roll back, and no approval step.
- **One server image with the Prisma CLI in it:** simpler, but the API image's dependencies would
  grow from ~90 MB to ~320 MB (measured 2026-11-11).
- **Backups to OVH Object Storage / Backblaze B2:** both work; R2 is free at our size and at another
  company than the server.

## Consequences
- A GitHub secret (the deploy key) can redeploy a commit on the server, nothing more.
- Migrations only move forward: rolling back past a schema change needs a new fixing migration.
- Cloudflare holds both the public entry point (ADR 0004) and the backups: an account problem there
  affects both, but not the running server or its local backups.

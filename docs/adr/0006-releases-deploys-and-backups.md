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
- **Deploys from `dev` until v1.0** (owner, 2026-11-11): every PR builds the images (a broken
  Dockerfile fails before the merge); a merge into `dev` pushes them to GHCR and starts a deploy job
  that waits for the owner's approval (GitHub environment `production`), then runs
  `scripts/deploy.sh <commit>` on the server over SSH. The SSH key may run only that script (forced
  command), as for UrConnections. The first deploy is run by hand with the same script, to see
  every step. `main` gets its first release, v1.0, at the end of the project.
- **Every start** runs `migrate` (schema) and `seed` (verified provider data from git) before the API,
  so a data change reaches production with the next deploy.
- **Backups** (stage 3e-4): a `pg_dump` every 24 hours and before every deploy, kept 14 days on
  the server; copied every 6 hours to **Cloudflare R2**, kept 30 days, in a bucket with a key of
  FreuTransfer's own (not UrConnections'); a restore drill from R2. Old dumps are deleted by the
  time in their name and the newest is always kept, so a backup outage never empties the bucket.
  The scripts (`deploy/backup`) are mounted as a folder, not built into an image: no fourth image
  to build and publish, and a folder mount (unlike a single-file mount) shows the new files after
  a deploy.

## Alternatives considered
- **Release `dev` → `main` for every deploy:** the textbook flow, but a PR per deploy adds nothing
  for one developer while the project is unfinished; `dev` already only takes reviewed, green PRs.
  Cost: until v1.0 the repository's `main` shows old code; making `dev` the default branch on
  GitHub (owner's setting) shows visitors what is live.
- **Deploy by hand only:** fine for one release, error-prone when repeated.
- **The server pulls new images by itself** (an updater container): no key in GitHub, but harder to
  see what runs and to roll back, and no approval step.
- **One server image with the Prisma CLI in it:** simpler, but the API image's dependencies would
  grow from ~90 MB to ~320 MB (measured 2026-11-11).
- **Backups to OVH Object Storage / Backblaze B2:** both work; R2 is free at our size and at another
  company than the server.

## Consequences
- A GitHub secret (the deploy key) can redeploy a commit that is part of `dev`'s history, nothing
  more. `deploy.sh` checks this (added after the security review of 2026-11-12): it runs the
  checked-out commit's own copy of itself, so a commit from any other branch could run anything.
- Migrations only move forward: rolling back past a schema change needs a new fixing migration.
- Cloudflare holds both the public entry point (ADR 0004) and the backups: an account problem there
  affects both, but not the running server or its local backups.

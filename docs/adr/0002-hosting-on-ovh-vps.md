# ADR 0002: Host production on the owner's OVH VPS

- **Status:** accepted
- **Date:** 2026-11-04
- **Supersedes:** the hosting parts of ADR 0001 (Vercel / Render, Neon, GitHub Actions cron)

## Context
ADR 0001 assumed free serverless hosting: Vercel for web + API, Neon for Postgres and GitHub Actions
cron for the collectors. The owner already pays for an **OVH VPS** and owns a **domain**, so a single
always-on server costs nothing extra.

## Decision
Run everything on the VPS with **Docker Compose**:

- **Postgres 18.6** in a container with a named volume. It is **not** published to the internet; only
  the API and the collectors reach it over the internal Compose network.
- **API** (Express 5, run on Node 26 as a normal long-lived server, exactly as in development).
- **Reverse proxy** with automatic Let's Encrypt HTTPS on the owner's domain. It serves the built
  React files and forwards `/v1/*`, `/health` and `/docs` to the API.
- **Collectors** run as a one-off container started by a **systemd timer**, whose `OnCalendar` accepts
  `Europe/Zurich`, so the daily ECB-aligned snapshot is DST-safe.
- **Backups:** a nightly `pg_dump` kept on the VPS and copied off the server (target chosen at deploy).
- **CI** stays on GitHub Actions. A deploy job (SSH to the VPS, pull, `docker compose up -d`) is added
  once the server is prepared.

Exact versions (proxy image, OS packages) are checked on the day of the first deploy (step 3).

## Alternatives considered
- **Vercel + Neon + GitHub cron** (ADR 0001): free, but three providers, a serverless DB driver and a
  cron with no time-zone support. No longer needed now that a server is available.
- **Render free tier:** sleeps after 15 minutes idle (slow first load for a reviewer).

## Consequences
- One server to operate: OS updates, firewall (only 22/80/443 open), SSH keys only, backups. That is
  extra work, but also a portfolio point (real deployment, not just a platform button).
- No cold starts and no free-tier limits on compute hours or DB size.
- Production and development use the same Postgres driver (`@prisma/adapter-pg`); no Neon adapter.
- If the VPS is down, everything is down. Acceptable for a portfolio project; backups make it recoverable.

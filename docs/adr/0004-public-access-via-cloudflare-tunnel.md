# ADR 0004: Public access through a Cloudflare Tunnel

- **Status:** accepted
- **Date:** 2026-11-08
- **Supersedes:** the public entry point in ADR 0002 (own reverse proxy with Let's Encrypt on 80/443)

## Context
ADR 0002 planned a reverse proxy on the VPS that gets its own Let's Encrypt certificates. A read-only
check of the server (2026-11-08) showed that ports 80/443 already belong to the **UrConnections** stack:
its Caddy container is the only public entry point, and the firewall opens only 22, 80 and 443. The
domain `aelshafey.com` is managed at Cloudflare (registrar + DNS).

## Decision
FreuTransfer reaches the internet through a **Cloudflare Tunnel**: a `cloudflared` container in
FreuTransfer's own Compose project opens an **outbound** connection to Cloudflare. It publishes no ports
and changes nothing in the UrConnections stack.

- HTTPS ends at Cloudflare; the tunnel carries the traffic to the containers on the internal network.
- Routing stays as in ADR 0002: `/v1/*` and `/health` go to the API, everything else to the built
  React files. The page calls `/v1/...` on its own origin, in development (Vite proxy) and production.
- The tunnel token is a secret in the server's `.env`, never in git.
- Still open, decided at stage 3e: the subdomain, and which container serves the static files.

## Alternatives considered
- **A site block in UrConnections' Caddy:** works, but ties FreuTransfer's deploys to another
  project's configuration and restarts.
- **A second proxy on 80/443:** impossible while UrConnections holds those ports.

## Consequences
- No new open port and no certificate handling on the VPS.
- Cloudflare is now in the request path: if it is down, the site is down (the VPS still runs).
- Postgres stays private, as in ADR 0002.

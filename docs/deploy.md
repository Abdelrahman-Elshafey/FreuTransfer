# Deploy runbook

How FreuTransfer runs in production and how to operate it. Decisions behind it: ADR 0002 (OVH VPS,
Docker Compose), ADR 0004 (Cloudflare Tunnel), ADR 0006 (releases and backups).

**Address:** https://freutransfer.aelshafey.com · **Server:** the OVH VPS shared with UrConnections,
folder `~/apps/freutransfer`, Compose project `freutransfer-prod`.

```
Cloudflare ──tunnel──▶ web (nginx) ─┬─ /v1/*, /health ─▶ api ──▶ db (Postgres)
(outbound only)                      └─ everything else: the built page
```

| Service | Image | Runs |
|---|---|---|
| `db` | `postgres:18.6` | always; data in the `pgdata` volume; no port |
| `migrate` | `freutransfer-migrate` | once per start: `prisma migrate deploy`, then exits |
| `seed` | `freutransfer-api` | once per start: loads verified provider data from `data/manual`, then exits |
| `api` | `freutransfer-api` | always; Express on port 3000 inside the network |
| `web` | `freutransfer-web` | always; nginx on 8080 inside the network: the page + routing (`apps/web/nginx.conf`) |
| `tunnel` | `cloudflare/cloudflared` | always on the server (profile `tunnel`); dials out to Cloudflare |

Nothing publishes a port on the server. UrConnections (its Caddy owns 80/443) is never touched.

## Run it locally

Needs Docker Desktop running. Uses a throwaway password; no tunnel, no GitHub images.

```sh
# once: a local .env.prod (git-ignored) with only a password
printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)" > .env.prod

# build the images and start everything (waits until healthy)
docker compose -f compose.prod.yml -f compose.local.yml --env-file .env.prod up -d --build --wait
```

Then open http://127.0.0.1:8080 (`compose.local.yml` adds this one local port), or:

```sh
curl http://127.0.0.1:8080/health
curl "http://127.0.0.1:8080/v1/compare?from=CHF&to=EUR&amount=2500"
```

Stop with `docker compose -f compose.prod.yml -f compose.local.yml --env-file .env.prod down`
(add `-v` to also delete the local production database).

Notes:
- `pnpm install` inside the images prints that Prisma doesn't support Node 26. Prisma's package says
  `"node": ">=24.0"` (checked 2026-11-11); the message is outdated and harmless.
- The images are built from the repo root; `.dockerignore` keeps `.env*`, tests, docs and
  `node_modules` out of them (the images are public on GHCR).

## First deploy (stage 3e-3)

### 1. Owner: Cloudflare Tunnel (about 10 minutes)
1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** →
   type **Cloudflared** → name `freutransfer` → save.
2. On the "Install connector" screen, copy the **token** (the long string after `--token`). Don't
   install anything: the `tunnel` container is the connector. Keep the token private.
3. Add a **public hostname** (newer dashboards may call it a *published application route*):
   subdomain `freutransfer`, domain `aelshafey.com`, path empty, service type **HTTP**, URL
   **`web:8080`**. Cloudflare creates the DNS record itself.

### 2. Owner: the secrets file on the server
```sh
ssh ubuntu@15.235.241.21
mkdir -p ~/apps/freutransfer && cd ~/apps/freutransfer
# (Claude copies compose.prod.yml and .env.prod.example here first)
cp .env.prod.example .env.prod && chmod 600 .env.prod
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env.prod
nano .env.prod   # paste the tunnel token after TUNNEL_TOKEN=, save
```
The password and the token stay on the server; never in git or a chat.

### 3. Start (Claude, with the owner's OK)
```sh
cd ~/apps/freutransfer
dc() { docker compose -f compose.prod.yml --env-file .env.prod "$@"; }
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<commit id CI built>/" .env.prod
dc pull
dc up -d --no-build --wait
dc ps -a                                       # migrate and seed: Exited (0); the rest: healthy
dc exec web wget -qO- http://127.0.0.1:8080/health
curl -s https://freutransfer.aelshafey.com/health
```
Then check the page in all four languages, and that UrConnections is still healthy
(`docker ps --filter name=urconnections`).

## Update, roll back, look around

Automated deploys from GitHub come in stage 3e-2 (ADR 0006); by hand, on the server:

```sh
cd ~/apps/freutransfer
dc() { docker compose -f compose.prod.yml --env-file .env.prod "$@"; }
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<commit id>/" .env.prod   # the version to run
dc pull && dc up -d --no-build --wait
```

- **Roll back:** the same, with the previous commit id. Migrations only move forward, so a rollback
  past a schema change needs a new fixing migration instead.
- **Logs:** `dc logs -f api` (or `web`, `tunnel`; `dc logs migrate seed` for the last start).
- **Database shell:** `dc exec db psql -U freu -d freu_transfer`.
- Every `up` re-runs `migrate` and `seed`; both are safe to repeat (no new migration = nothing to
  do; already stored rows are skipped, an edited history row stops the seed with an error).

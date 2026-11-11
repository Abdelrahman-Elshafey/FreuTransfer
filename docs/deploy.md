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

## How a deploy works

`scripts/deploy.sh <commit id>`, on the server, in a copy of this (public) repository:
1. accepts only a 40-character commit id, and only one deploy at a time;
2. checks that commit out (the server always equals one commit of the repo; `.env.prod` is
   git-ignored and never touched);
3. pulls that commit's images from GHCR (built by CI, never on the server) and records the tag in
   `.env.prod`;
4. starts them (`migrate` → `seed` → `api` → `web`) and waits until everything is healthy;
5. deletes FreuTransfer's images of older commits (never UrConnections' images).

After a merge into `dev`, CI builds and pushes the images and the `deploy` job waits for the owner's
approval; then GitHub runs that script over SSH and checks `/health` from outside (ADR 0006).

## First deploy (stage 3e-3)

### 1. Owner: Cloudflare Tunnel (about 10 minutes)
1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** →
   type **Cloudflared** → name `freutransfer` → save.
2. On the "Install connector" screen, copy the **token** (the long string after `--token`). Don't
   install anything: the `tunnel` container is the connector. Keep the token private.
3. Add a **public hostname** (newer dashboards may call it a *published application route*):
   subdomain `freutransfer`, domain `aelshafey.com`, path empty, service type **HTTP**, URL
   **`web:8080`**. Cloudflare creates the DNS record itself.

### 2. Owner: make the images public (once, after the first merge into `dev` with this workflow)
GitHub → your profile → **Packages** → `freutransfer-api`, `freutransfer-migrate`,
`freutransfer-web` → **Package settings** → **Change visibility** → **Public**. GitHub creates
packages as private even for a public repository; public ones need no password on the server.

### 3. Claude (with the owner's OK): the repository on the server
```sh
ssh ubuntu@15.235.241.21
git clone https://github.com/Abdelrahman-Elshafey/FreuTransfer.git ~/apps/freutransfer
```

### 4. Owner: the secrets file on the server
```sh
cd ~/apps/freutransfer
cp .env.prod.example .env.prod && chmod 600 .env.prod
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env.prod
nano .env.prod   # paste the tunnel token after TUNNEL_TOKEN=, save
```
The password and the token stay on the server; never in git or a chat.

### 5. Claude (with the owner's OK): deploy by hand
```sh
cd ~/apps/freutransfer
sh scripts/deploy.sh <commit id of the newest dev merge>
dc() { docker compose -f compose.prod.yml --env-file .env.prod "$@"; }
dc ps -a                                       # migrate and seed: Exited (0); the rest: healthy
dc exec web wget -qO- http://127.0.0.1:8080/health
curl -s https://freutransfer.aelshafey.com/health
```
Then check the page in all four languages, and that UrConnections is still healthy
(`docker ps --filter name=urconnections`).

### 6. Owner: switch on automatic deploys (about 10 minutes)
1. **A key only for deploys**, on your PC (PowerShell; no passphrase, because GitHub uses it unattended):
   ```powershell
   ssh-keygen -t ed25519 -N '""' -C freutransfer-deploy -f "$HOME/.ssh/freutransfer_deploy"
   ```
2. **On the server, allow that key to run only the deploy script.** Send Claude the *public* key
   (`freutransfer_deploy.pub`, safe to share), or add this line yourself to `~/.ssh/authorized_keys`:
   ```
   command="sh /home/ubuntu/apps/freutransfer/scripts/deploy.sh",restrict ssh-ed25519 AAAA… freutransfer-deploy
   ```
3. **GitHub → repository → Settings → Environments → New environment** `production`:
   - **Required reviewers:** yourself (every deploy waits for your click);
   - **Deployment branches and tags:** selected branches → `dev`;
   - **Environment secret** `DEPLOY_SSH_KEY`: the whole content of the *private* key file
     `freutransfer_deploy` (never share it anywhere else).
4. **Settings → Secrets and variables → Actions → Variables** (repository variables):
   - `DEPLOY_KNOWN_HOSTS`: the server's host key line, which Claude reads from the server and
     checks against its fingerprint;
   - `DEPLOY_HOST`: `15.235.241.21`. Add this one **last**: the deploy job is skipped until it
     exists, so nothing tries to deploy before the server is ready.

## Update, roll back, look around

- **Update:** merge a PR into `dev`, then approve the deploy in the Actions tab (or run
  `sh scripts/deploy.sh <commit id>` on the server).
- **Roll back:** Actions → an older successful run → **Re-run jobs** (or the script with the older
  commit id). Migrations only move forward, so a rollback past a schema change needs a new fixing
  migration instead.
- **Logs:** `dc logs -f api` (or `web`, `tunnel`; `dc logs migrate seed` for the last start).
- **Database shell:** `dc exec db psql -U freu -d freu_transfer`.
- Every start re-runs `migrate` and `seed`; both are safe to repeat (no new migration = nothing to
  do; already stored rows are skipped, an edited history row stops the seed with an error).

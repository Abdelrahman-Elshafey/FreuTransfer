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
| `backup` | `postgres:18.6` | always; a database dump now and every 24 hours, kept 14 days in the `backups` volume |
| `offsite` | `rclone/rclone` | always on the server (profile `offsite`); copies the dumps to Cloudflare R2 every 6 hours, kept 30 days |

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
3. pulls that commit's images from GHCR (built by CI, never on the server);
4. **backs up the database** (unless it isn't running yet): a failed backup stops the deploy, so
   migrations never run without a dump taken just before them;
5. records the tag in `.env.prod`, starts the new version (`migrate` → `seed` → `api` → `web`) and
   waits until everything is healthy;
6. deletes FreuTransfer's images of older commits (never UrConnections' images).

It refuses to run unless `.env.prod` has `IMAGE_PREFIX=ghcr.io/…` and
`COMPOSE_PROFILES=tunnel,offsite`.

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

## Backups (stage 3e-4)

Two copies, because a dump on the server dies with the server (OVH's Strasbourg data center burned
down in 2021):

| Copy | Where | When | Kept |
|---|---|---|---|
| `backup` (`deploy/backup/backup.sh`) | `backups` volume on the server | at start, every 24 h, and before every deploy | 14 days |
| `offsite` (`deploy/backup/offsite.sh`) | Cloudflare R2 bucket `freutransfer-backups` | every 6 h, new dumps only | 30 days |

- A dump is `freutransfer-YYYYMMDD-HHMMSS.dump` (UTC time, `pg_dump` custom format). The age used to
  delete old dumps is the time in the name, and the **newest dump is never deleted**, so if backups
  stop, the last good one stays (`deploy/backup/old-dumps.sh`).
- A failed round is logged (`backup: FAILED`, `offsite: … FAILED`) and retried at the next round.
  Nothing alerts yet (no roadmap stage covers it; open item in `docs/progress.md`): check
  `dc logs --since 48h backup offsite` after each deploy.
- The scripts are mounted as a folder and each round starts them anew, so a deploy that changes them
  needs no restart.
- Tested in `deploy/backup.test.ts` with the production images: a dump restores to the same data, a
  failed dump leaves no partial file and keeps the old ones, old dumps go and others stay, copies
  in R2 outlive the server's 14 days, the newest copy is kept.

### Owner: the R2 bucket and its key (once)
1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket** → name `freutransfer-backups`,
   location automatic, storage class Standard. Leave public access off.
2. R2 overview → **Manage API tokens** → **Create Account API token**: name `freutransfer-backups`,
   permission **Object Read & Write**, **only the bucket `freutransfer-backups`**, TTL forever. A
   stolen key then reaches nothing else (not UrConnections' bucket).
3. Keep the **Access Key ID**, **Secret Access Key** and the **S3 endpoint**
   (`https://<account id>.r2.cloudflarestorage.com`) from the page shown once.
4. On the server, before the deploy that brings this change:
   ```sh
   cd ~/apps/freutransfer
   nano .env.prod
   ```
   Change `COMPOSE_PROFILES=tunnel` to `COMPOSE_PROFILES=tunnel,offsite`, and add at the end:
   ```
   OFFSITE_S3_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
   OFFSITE_S3_BUCKET=freutransfer-backups
   OFFSITE_S3_ACCESS_KEY_ID=<access key id>
   OFFSITE_S3_SECRET_ACCESS_KEY=<secret access key>
   ```
   Check without showing the secrets:
   ```sh
   awk -F= '/^(OFFSITE_|COMPOSE_PROFILES)/ {print $1, (length($2) ? "set" : "EMPTY")}' .env.prod
   ```

### Check
```sh
dc logs backup offsite                       # backup: wrote …  ·  offsite: N dumps in r2:freutransfer-backups
dc exec -T offsite sh /scripts/offsite.sh    # copy now
dc exec -T offsite sh -c 'rclone lsf "r2:$OFFSITE_S3_BUCKET"'
```

### Restore drill (after setting it up, and after any big change)
Always from **R2**, the copy you would depend on if the server were gone, into a scratch database,
so the live site isn't touched:
```sh
FILE=$(dc exec -T offsite sh -c 'rclone lsf --include "freutransfer-*.dump" "r2:$OFFSITE_S3_BUCKET"' | sort | tail -1)
dc exec -T db createdb -U freu restore_check
dc exec -T offsite sh -c "rclone cat \"r2:\$OFFSITE_S3_BUCKET/$FILE\"" | dc exec -T db pg_restore -U freu --no-owner -d restore_check
COUNTS="select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' order by 1"
dc exec -T db psql -U freu -d freu_transfer -tA -c "$COUNTS" > /tmp/live.txt
dc exec -T db psql -U freu -d restore_check -tA -c "$COUNTS" > /tmp/restored.txt
diff /tmp/live.txt /tmp/restored.txt && echo "restore drill passed"
dc exec -T db dropdb -U freu restore_check
```
Equal counts in every table = passed (data written after the dump would show as a difference).

### Real restore (lost volume or new server)
Deploy the stack, stop what writes (`dc stop api`), then restore the chosen dump over the database:
```sh
dc exec -T offsite sh -c "rclone cat \"r2:\$OFFSITE_S3_BUCKET/$FILE\"" | dc exec -T db pg_restore -U freu --no-owner --clean --if-exists -d freu_transfer
dc up -d --wait
```

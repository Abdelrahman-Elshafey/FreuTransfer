#!/bin/sh
# Deploys one commit on the server (docs/deploy.md, ADR 0006). Run by the `deploy` job in
# .github/workflows/ci.yml over SSH, or by hand on the server:
#   sh scripts/deploy.sh <40-character commit id>
#
# SECURITY: the GitHub deploy key may run ONLY this script. Its line in ~/.ssh/authorized_keys
# starts with  command="sh /home/ubuntu/apps/freutransfer/scripts/deploy.sh",restrict
# so whatever command the client sends arrives here as $SSH_ORIGINAL_COMMAND, and it is accepted
# only if it is a commit id that is part of `dev`'s history. A stolen key can redeploy a commit
# on dev, nothing else (not a commit of another branch, whose own copy of this script would run
# in phase 2).
#
# Two phases, because phase 1 replaces this very file:
#   1. check the commit id, fetch it, check it out (detached: the server runs exactly that commit)
#   2. run the NEW version of this script (`exec … --apply`), which deploys it
set -eu
cd "$(dirname "$0")/.."
dc() { docker compose -f compose.prod.yml --env-file .env.prod "$@"; }

if [ "${1:-}" != "--apply" ]; then
  SHA="${1:-${SSH_ORIGINAL_COMMAND:-}}"
  case "$SHA" in
    "" | *[!0-9a-f]*) echo "deploy: expected a commit id, got '$SHA'" >&2; exit 2 ;;
  esac
  [ ${#SHA} -eq 40 ] || { echo "deploy: expected a 40-character commit id" >&2; exit 2; }

  # One deploy at a time (GitHub queues its own runs; this also covers a deploy by hand).
  # fd 9 stays open across `exec`, so the lock is held until phase 2 ends.
  exec 9>/tmp/freutransfer-deploy.lock
  flock -n 9 || { echo "deploy: another deploy is running" >&2; exit 1; }

  OLD=$(git rev-parse HEAD)
  git fetch --quiet origin
  # Only commits on dev (the newest or an older one: a rollback). Phase 2 runs the deploy.sh of
  # the checked-out commit, so a commit from any other branch could run anything here.
  git merge-base --is-ancestor "$SHA" origin/dev ||
    { echo "deploy: $SHA is not a commit on dev" >&2; exit 2; }
  # --force: hand edits to tracked files are thrown away; the server must equal the repo.
  # Ignored files (.env.prod) are never touched.
  git checkout --quiet --force --detach "$SHA"
  exec sh scripts/deploy.sh --apply "$OLD" "$SHA"
fi

OLD="$2"
SHA="$3"
echo "deploy: $OLD -> $SHA"
grep -q '^IMAGE_PREFIX=ghcr.io/' .env.prod || { echo "deploy: set IMAGE_PREFIX in .env.prod" >&2; exit 1; }
# The server runs the tunnel (the way in) and the off-site copies; without them in
# COMPOSE_PROFILES, `up` would silently leave them out.
grep -q '^COMPOSE_PROFILES=tunnel,offsite$' .env.prod ||
  { echo "deploy: set COMPOSE_PROFILES=tunnel,offsite in .env.prod" >&2; exit 1; }

# 1. Pull the images CI built for this commit; nothing is built on the server. A variable from
#    the shell wins over .env.prod, so this pulls the NEW tag.
export IMAGE_TAG="$SHA"
dc pull --quiet migrate api web

# 2. A database backup before the new version's migrations run (deploy/backup/backup.sh), so a
#    bad migration can be undone from it. Skipped only if the database isn't running (the very
#    first start: nothing to save yet). A failed backup stops the deploy.
if [ -n "$(dc ps --status running --quiet db)" ]; then
  # -T: no terminal; a deploy started by GitHub over SSH has none.
  dc run --rm --no-deps -T backup "sh /scripts/backup.sh"
fi

# 3. Only after a successful pull, record the version in .env.prod: a later manual `dc up`
#    then starts the same images instead of an older tag.
if grep -q '^IMAGE_TAG=' .env.prod; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$SHA/" .env.prod
else
  echo "IMAGE_TAG=$SHA" >> .env.prod
fi

# 4. Start the new version: migrate and seed run first, api and web are replaced,
#    --wait = until everything is healthy (and migrate/seed finished successfully).
dc up -d --no-build --wait

# 5. Remove FreuTransfer's images of earlier commits (each deploy adds three). Only ours: the
#    server is shared with UrConnections, so no global `docker image prune`. Rollback still works:
#    this script pulls an older commit's images from GHCR again.
PREFIX=$(sed -n 's/^IMAGE_PREFIX=//p' .env.prod)
docker image ls --format '{{.Repository}}:{{.Tag}}' \
  | grep "^${PREFIX}freutransfer-" | grep -v ":$SHA\$" \
  | xargs -r docker image rm >/dev/null

echo "deploy: $SHA is live"

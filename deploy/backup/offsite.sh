#!/bin/sh
# Copies the database dumps off the server (docs/deploy.md, "Backups"; ADR 0006). Run by the
# `offsite` service in compose.prod.yml every 6 hours. A dump on the server dies with the server
# or its data center, so every dump also goes to a bucket at another company (Cloudflare R2).
#
# rclone builds its remote "r2" from RCLONE_CONFIG_R2_* variables (compose.prod.yml), so there is
# no config file to manage. The key may only touch FreuTransfer's own bucket.
#   - `rclone copy` only adds: a dump deleted on the server stays in the bucket.
#   - Copies older than OFFSITE_KEEP_DAYS are deleted by the time in their name (old-dumps.sh);
#     the newest copy is always kept.
set -eu
# shellcheck source=deploy/backup/old-dumps.sh
. "$(dirname "$0")/old-dumps.sh"
KEEP_DAYS="${OFFSITE_KEEP_DAYS:?set OFFSITE_KEEP_DAYS}"

if [ -z "${OFFSITE_S3_BUCKET:-}" ] || [ -z "${RCLONE_CONFIG_R2_ENDPOINT:-}" ] ||
  [ -z "${RCLONE_CONFIG_R2_ACCESS_KEY_ID:-}" ] || [ -z "${RCLONE_CONFIG_R2_SECRET_ACCESS_KEY:-}" ]; then
  echo "offsite: set OFFSITE_S3_ENDPOINT, OFFSITE_S3_BUCKET, OFFSITE_S3_ACCESS_KEY_ID and OFFSITE_S3_SECRET_ACCESS_KEY in .env.prod" >&2
  exit 1
fi
REMOTE="r2:$OFFSITE_S3_BUCKET"

# Only finished dumps: a .tmp that backup.sh is still writing doesn't match.
if ! rclone copy /backups "$REMOTE" --include 'freutransfer-*.dump' --max-depth 1 --stats 0; then
  echo "offsite: copy to $REMOTE FAILED" >&2
  exit 1
fi

# The `exit 1` leaves only the loop's subshell; its status fails the pipeline and `set -e` stops.
rclone lsf --files-only --max-depth 1 "$REMOTE" | old_dumps "$KEEP_DAYS" | while read -r old; do
  rclone deletefile "$REMOTE/$old" || exit 1
  echo "offsite: removed $old (older than $KEEP_DAYS days)"
done

count=$(rclone lsf --files-only --max-depth 1 --include 'freutransfer-*.dump' "$REMOTE" | wc -l)
echo "offsite: $count dumps in $REMOTE"

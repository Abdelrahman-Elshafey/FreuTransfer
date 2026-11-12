#!/bin/sh
# One database backup (docs/deploy.md, "Backups"; ADR 0006). Run by the `backup` service in
# compose.prod.yml every 24 hours, and by scripts/deploy.sh before every deploy (so a bad
# migration can be undone from the dump taken just before it).
#
# pg_dump takes a consistent snapshot while the site keeps running. Custom format (-Fc) is
# compressed and restored with pg_restore (docs/deploy.md, "Restore"). Connection settings come
# from PGHOST / PGUSER / PGPASSWORD / PGDATABASE (compose.prod.yml).
# After a successful dump, dumps older than BACKUP_KEEP_DAYS are deleted (old-dumps.sh).
# offsite.sh copies the dumps to another company: a dump on this disk dies with this disk.
set -eu
# shellcheck source=deploy/backup/old-dumps.sh
. "$(dirname "$0")/old-dumps.sh"
KEEP_DAYS="${BACKUP_KEEP_DAYS:?set BACKUP_KEEP_DAYS}"

file="/backups/freutransfer-$(date -u +%Y%m%d-%H%M%S).dump"
# Write to .tmp and rename only on success: a half-written file is never taken for a backup.
if ! pg_dump --format=custom --no-owner --file="$file.tmp"; then
  rm -f "$file.tmp"
  echo "backup: FAILED (older dumps kept)" >&2
  exit 1
fi
mv "$file.tmp" "$file"
echo "backup: wrote $file ($(du -h "$file" | cut -f1))"

# The `exit 1` leaves only the loop's subshell; its status fails the pipeline and `set -e` stops.
find /backups -maxdepth 1 -type f -printf '%f\n' | old_dumps "$KEEP_DAYS" | while read -r old; do
  rm "/backups/$old" || exit 1
  echo "backup: removed $old (older than $KEEP_DAYS days)"
done

# Shared by backup.sh and offsite.sh (sourced, not run). docs/deploy.md, "Backups".
#
#   ... | old_dumps <days>
# reads file names on stdin and prints the dumps to delete: those whose name says they were
# taken more than <days> days ago. The name holds the dump's UTC time
# (freutransfer-YYYYMMDD-HHMMSS.dump), so the age never depends on a file's modification time,
# which a copy may change. Other names are never printed.
# The newest dump is never printed, however old: if backups stop working, the last good one must
# not age away with the rest.
old_dumps() {
  cutoff="freutransfer-$(date -u -d "@$(($(date +%s) - $1 * 86400))" +%Y%m%d-%H%M%S).dump"
  # Same length and format on both sides, so comparing as text compares the times.
  grep -E '^freutransfer-[0-9]{8}-[0-9]{6}\.dump$' | sort | sed '$d' | awk -v cutoff="$cutoff" '$0 < cutoff'
}

#!/usr/bin/env bash
#
# Daily Postgres backup with GFS rotation. Runs pg_dump inside the postgres
# container in custom format (compressed binary, restorable with pg_restore).
#
# Layout:
#   /opt/swisscresta/backups/db/daily/   — kept 14 days
#   /opt/swisscresta/backups/db/weekly/  — Sunday's daily, kept 8 weeks
#   /opt/swisscresta/backups/db/monthly/ — 1st-of-month, kept 12 months
#
# Cron (3:15 AM IST as the `swiss` user):
#   15 3 * * * /opt/swisscresta/deploy/scripts/backup-db.sh
#
# Restore with deploy/scripts/restore-db.sh <file>.
#
# Off-server copy (optional but recommended): rclone to Hostinger Object
# Storage / S3 / Backblaze. Set RCLONE_REMOTE in /opt/swisscresta/.env and
# uncomment the rclone block at the bottom.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/swisscresta}"
BACKUP_ROOT="${BACKUP_ROOT:-$REPO_DIR/backups/db}"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml"

mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"

STAMP=$(date +%Y%m%d-%H%M%S)
DOW=$(date +%u)        # 1..7, Mon..Sun
DOM=$(date +%d)        # 01..31
FILE="$BACKUP_ROOT/daily/swisscresta-$STAMP.dump"
LOG="$BACKUP_ROOT/backup.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

cd "$REPO_DIR"

log "starting pg_dump → $FILE"
# pg_dump inside the postgres container. -F c = custom (binary, compressed,
# parallel-restore-capable). Stream stdout to host file.
if ! $COMPOSE exec -T postgres sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -F c "$POSTGRES_DB"' \
    > "$FILE"; then
  log "FAIL pg_dump errored; removing partial file"
  rm -f "$FILE"
  exit 1
fi

SIZE=$(stat -c%s "$FILE")
if [ "$SIZE" -lt 1024 ]; then
  log "FAIL dump is suspiciously small ($SIZE bytes); removing"
  rm -f "$FILE"
  exit 1
fi
log "ok daily ($SIZE bytes)"

# Promote to weekly on Sunday (DOW=7) and monthly on the 1st.
if [ "$DOW" = "7" ]; then
  cp -a "$FILE" "$BACKUP_ROOT/weekly/swisscresta-$STAMP.dump"
  log "promoted → weekly"
fi
if [ "$DOM" = "01" ]; then
  cp -a "$FILE" "$BACKUP_ROOT/monthly/swisscresta-$STAMP.dump"
  log "promoted → monthly"
fi

# Rotation. Mtime-based, not count-based, so a missed day doesn't shift the
# window. Numbers tuned for a small wallet DB; bump if disk pressure builds.
find "$BACKUP_ROOT/daily"   -type f -name 'swisscresta-*.dump' -mtime +14 -delete
find "$BACKUP_ROOT/weekly"  -type f -name 'swisscresta-*.dump' -mtime +56 -delete
find "$BACKUP_ROOT/monthly" -type f -name 'swisscresta-*.dump' -mtime +365 -delete
log "rotation done"

# ── Off-server upload (uncomment after configuring rclone) ───────────────
# if [ -n "${RCLONE_REMOTE:-}" ]; then
#   log "rclone sync → $RCLONE_REMOTE"
#   rclone sync "$BACKUP_ROOT" "$RCLONE_REMOTE" --log-file="$LOG"
# fi

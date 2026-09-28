#!/usr/bin/env bash
#
# Restore a Postgres dump produced by backup-db.sh. DESTRUCTIVE — drops and
# recreates every object in the target database. Requires explicit YES.
#
# Usage:
#   deploy/scripts/restore-db.sh /opt/swisscresta/backups/db/daily/swisscresta-YYYYMMDD-HHMMSS.dump
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/swisscresta}"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml"

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: $0 <dump-file>" >&2
  exit 2
fi

echo "About to restore: $FILE"
echo "Target: postgres container at $REPO_DIR"
echo "This will DROP existing tables and replace them with the dump's contents."
read -r -p "Type 'YES' to proceed: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "Aborted."; exit 1; }

cd "$REPO_DIR"

# Stream the dump into pg_restore inside the postgres container.
# --clean --if-exists makes the restore idempotent against a populated DB.
# --no-owner avoids "role does not exist" noise when restoring across envs.
cat "$FILE" | $COMPOSE exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Restore complete. You should restart any service that caches DB state:"
echo "  $COMPOSE restart gateway admin-api"

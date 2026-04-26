#!/usr/bin/env bash
#
# kerf — daily database backup template.
#
# Streams a gzipped pg_dump of the production postgres into ./backups/
# and prunes anything older than RETENTION_DAYS (default 14). Designed
# to be run from the kerf project root via host cron — assumes
# postgres is up under docker-compose.prod.yml.
#
# Cron example (3 AM UTC daily, log to file, alert non-zero exit):
#   0 3 * * * cd /opt/kerf && ./scripts/backup-db.sh >> /var/log/kerf-backup.log 2>&1
#
# Restore from a backup:
#   gunzip -c backups/kerf-YYYYMMDDTHHMMSSZ.sql.gz \
#     | docker compose -f docker-compose.prod.yml exec -T postgres \
#         psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
#
# Make executable once after checkout: chmod +x scripts/backup-db.sh

set -euo pipefail

RETENTION_DAYS="${RETENTION_DAYS:-14}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/kerf-${TIMESTAMP}.sql.gz"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"

mkdir -p "$BACKUP_DIR"

# Load DB credentials from the same .env compose uses.
if [ -f "${PROJECT_ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${PROJECT_ROOT}/.env"
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER must be set in .env}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in .env}"

echo "[$(date -u +%FT%TZ)] backup → ${BACKUP_FILE}"

# pg_dump runs INSIDE the postgres container; output streams over
# stdin back to the host where it's gzipped and written to ./backups/.
# --clean + --if-exists so the dump can be replayed onto an existing
# DB without manual cleanup. --no-owner + --no-acl strips role info
# so the dump restores under whatever user runs psql.
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
  | gzip -9 > "$BACKUP_FILE"

BYTES="$(stat -c %s "$BACKUP_FILE" 2>/dev/null || stat -f %z "$BACKUP_FILE")"
echo "[$(date -u +%FT%TZ)] wrote ${BYTES} bytes"

# Prune old backups by mtime.
find "$BACKUP_DIR" -type f -name 'kerf-*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete \
  | sed "s/^/[$(date -u +%FT%TZ)] pruned /"

echo "[$(date -u +%FT%TZ)] done"

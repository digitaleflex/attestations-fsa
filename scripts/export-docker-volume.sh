#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Export PostgreSQL data from Docker Desktop volume
# =================================================================
# This script starts the PostgreSQL container, dumps the data,
# and saves it as a SQL file for VPS migration.
#
# USAGE:
#   ./scripts/export-docker-volume.sh
# =================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

VOLUME_NAME="${VOLUME_NAME:-attestations-fsa_postgres_data}"
CONTAINER_NAME="${CONTAINER_NAME:-attestations-fsa-postgres}"
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"
DB_PASSWORD="${DB_PASSWORD:-attestation_fsa_password}"
OUTPUT_DIR="${PROJECT_DIR}/Backup"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✅]${NC} $1"; }
warn() { echo -e "${YELLOW}[⚠️]${NC} $1"; }

cd "$PROJECT_DIR"

# Check if volume exists
if ! docker volume inspect "$VOLUME_NAME" &>/dev/null; then
  echo "❌ Volume '$VOLUME_NAME' not found!"
  echo ""
  echo "Available volumes:"
  docker volume ls | grep -i attestations || echo "  (none)"
  exit 1
fi

log "Volume found: $VOLUME_NAME"

# Start PostgreSQL container if not running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "Starting PostgreSQL container..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="$DB_NAME" \
    -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
    -p 5432:5432 \
    postgres:17-alpine

  log "Waiting for PostgreSQL to be ready..."
  sleep 5

  # Wait for PostgreSQL to be ready
  for i in {1..30}; do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" &>/dev/null; then
      break
    fi
    sleep 1
  done
fi

# Check if PostgreSQL is ready
if ! docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" &>/dev/null; then
  echo "❌ PostgreSQL is not ready!"
  exit 1
fi

success "PostgreSQL is running and ready!"

# Show table info
log "Database tables:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>/dev/null || true

# Show row counts
log "Row counts:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
" 2>/dev/null || true

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate dump file
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="${OUTPUT_DIR}/docker-dump-${TIMESTAMP}.sql"

log "Exporting database to: $DUMP_FILE"

docker exec "$CONTAINER_NAME" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  > "$DUMP_FILE"

# Check dump size
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
success "Export complete! File: $DUMP_FILE ($DUMP_SIZE)"

# Clean the dump (remove Prisma-specific extensions)
log "Cleaning dump for standard PostgreSQL..."
CLEANED_FILE="${OUTPUT_DIR}/docker-dump-${TIMESTAMP}-clean.sql"

if [ -f "$SCRIPT_DIR/fix-dump-for-local-postgres.sh" ]; then
  DUMP_FILE="$DUMP_FILE" CLEANED_FILE="$CLEANED_FILE" \
    "$SCRIPT_DIR/fix-dump-for-local-postgres.sh"
else
  # Manual cleanup
  grep -v "CREATE EXTENSION IF NOT EXISTS prisma_postgres" "$DUMP_FILE" | \
  grep -v "COMMENT ON EXTENSION prisma_postgres" > "$CLEANED_FILE"
fi

CLEANED_SIZE=$(du -h "$CLEANED_FILE" | cut -f1)
success "Cleaned dump: $CLEANED_FILE ($CLEANED_SIZE)"

echo ""
echo "=========================================="
echo "📦 Export Terminé!"
echo "=========================================="
echo ""
echo "Fichiers générés:"
echo "  1. $DUMP_FILE (original)"
echo "  2. $CLEANED_FILE (nettoyé pour VPS)"
echo ""
echo "Prochaines étapes:"
echo "  1. Transférer le dump nettoyé vers le VPS:"
echo "     scp $CLEANED_FILE user@your-vps:/home/audest/attestation-fsa/Backup/"
echo ""
echo "  2. Sur le VPS, restaurer:"
echo "     DB_PASSWORD='your_password' ./scripts/migrate-to-vps.sh --step=restore"
echo ""
echo "  3. Ou utiliser le script complet:"
echo "     DB_PASSWORD='your_password' ./scripts/migrate-to-vps.sh --step=full"
echo ""

# Stop container (optional, keep running for now)
warn "Le conteneur PostgreSQL tourne toujours ($CONTAINER_NAME)"
warn "Pour l'arrêter: docker stop $CONTAINER_NAME"

#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Migration Script: Prisma Postgres → Self-hosted PostgreSQL (VPS)
# =================================================================
#
# This script orchestrates the complete migration from Prisma Postgres
# to a self-hosted PostgreSQL instance on your VPS.
#
# PREREQUISITES:
#   1. Access to current Prisma Postgres (for dump) OR a SQL dump file
#   2. VPS with SSH access
#   3. The SQL dump transferred to the VPS
#
# USAGE:
#   # Step 1: If you still have access to Prisma Postgres, dump first
#   DB_URL="prisma+postgres://..." ./scripts/migrate-to-vps.sh --step dump
#
#   # Step 2: On VPS, run full migration
#   DB_PASSWORD='your_secure_password' ./scripts/migrate-to-vps.sh --step full
#
#   # Step 3: Or run individual steps
#   DB_PASSWORD='your_secure_password' ./scripts/migrate-to-vps.sh --step setup-db
#   DB_PASSWORD='your_secure_password' ./scripts/migrate-to-vps.sh --step restore
#   DB_PASSWORD='your_secure_password' ./scripts/migrate-to-vps.sh --step migrate
#   DB_PASSWORD='your_secure_password' ./scripts/migrate-to-vps.sh --step validate
#   DB_PASSWORD='your_secure_password' ./scripts/migrate-to-vps.sh --step env
# =================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DUMP_FILE="${DUMP_FILE:-./Backup/dump-complet.sql}"
CLEANED_DUMP="${CLEANED_DUMP:-./Backup/dump-complet-clean.sql}"
BACKUP_DIR="${BACKUP_DIR:-/home/audest/backups/attestation-fsa}"
APP_DIR="${APP_DIR:-/home/audest/attestation-fsa}"
ENV_FILE="${ENV_FILE:-.env}"
STEP="${STEP:-full}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✅]${NC} $1"; }
warn() { echo -e "${YELLOW}[⚠️]${NC} $1"; }
error() { echo -e "${RED}[❌]${NC} $1"; }

# Parse arguments
for arg in "$@"; do
  case $arg in
    --step=*) STEP="${arg#*=}" ;;
    --dump) DUMP_FILE="${2:-}" ;;
    --help)
      echo "Usage: $0 [--step=<step>]"
      echo ""
      echo "Steps:"
      echo "  dump       - Dump database from current Prisma Postgres"
      echo "  setup-db   - Install and configure PostgreSQL on VPS"
      echo "  restore    - Restore SQL dump to VPS PostgreSQL"
      echo "  migrate    - Run Prisma migrations on VPS"
      echo "  validate   - Validate the migration was successful"
      echo "  env        - Generate .env file for VPS"
      echo "  full       - Run all steps (except dump)"
      echo ""
      echo "Environment variables:"
      echo "  DB_PASSWORD - PostgreSQL password (required)"
      echo "  DB_NAME     - Database name (default: attestation_fsa)"
      echo "  DUMP_FILE   - Path to SQL dump (default: ./Backup/dump-complet.sql)"
      exit 0
      ;;
  esac
done

# =================================================================
# STEP: dump - Dump from current Prisma Postgres
# =================================================================
step_dump() {
  log "Step: Dumping from Prisma Postgres..."

  if [ -z "${DB_URL:-}" ]; then
    error "DB_URL must be set for dump step."
    error "Usage: DB_URL='prisma+postgres://...' ./scripts/migrate-to-vps.sh --step=dump"
    exit 1
  fi

  # Try pg_dump through Prisma's internal PostgreSQL connection
  # Prisma Postgres uses a special URL format, we need to extract the actual connection string
  warn "Prisma Postgres uses a special protocol. You have two options:"
  echo ""
  echo "Option A: Use Prisma's JSON dump (recommended if pg_dump isn't available):"
  echo "  npx prisma db execute --stdin <<'SQL'"
  echo "  -- The JSON dump can be generated via the Prisma dashboard"
  echo "  SQL"
  echo ""
  echo "Option B: Use pg_dump (requires direct PostgreSQL access):"
  echo "  1. Get the actual PostgreSQL URL from Prisma dashboard"
  echo "  2. Run: pg_dump '<actual_postgres_url>' > Backup/dump-complet.sql"
  echo ""
  echo "Option C: Use the Prisma dashboard export feature:"
  echo "  1. Go to https://database.prisma.io"
  echo "  2. Select your project"
  echo "  3. Use the Export/Backup feature to download a SQL dump"
  echo "  4. Save it as Backup/dump-complet.sql"
  echo ""
  warn "Place the dump file at: $DUMP_FILE"
  exit 0
}

# =================================================================
# STEP: setup-db - Install PostgreSQL on VPS
# =================================================================
step_setup_db() {
  log "Step: Setting up PostgreSQL on VPS..."

  if [ -z "$DB_PASSWORD" ]; then
    error "DB_PASSWORD must be set."
    error "Usage: DB_PASSWORD='your_secure_password' $0 --step=setup-db"
    exit 1
  fi

  # Check if PostgreSQL is already installed
  if command -v psql &>/dev/null; then
    warn "PostgreSQL client already installed."
    PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
    log "PostgreSQL version: $PG_VERSION"
  fi

  # Install PostgreSQL if not present
  if ! systemctl is-active --quiet postgresql 2>/dev/null; then
    log "Installing PostgreSQL 17..."

    # Add PostgreSQL APT repository
    install -d /usr/share/postgresql-common/pgdg
    curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc 2>/dev/null || true

    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
      https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list

    apt-get update -qq
    apt-get install -y -qq postgresql-17 postgresql-client-17
  fi

  # Configure PostgreSQL
  log "Configuring PostgreSQL..."
  PG_CONF="/etc/postgresql/17/main/postgresql.conf"
  if [ -f "$PG_CONF" ]; then
    # Listen only on localhost
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PG_CONF" 2>/dev/null || true
  fi

  # Start and enable PostgreSQL
  systemctl restart postgresql
  systemctl enable postgresql

  # Create database and user
  log "Creating database and user..."
  sudo -u postgres psql <<SQL
-- Create user
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER "${DB_USER}" WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

-- Create database
SELECT 'CREATE DATABASE "${DB_NAME}" OWNER "${DB_USER}"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE "${DB_NAME}" TO "${DB_USER}";
ALTER USER "${DB_USER}" WITH SUPERUSER;
SQL

  success "PostgreSQL setup complete!"
  echo ""
  echo "Connection string:"
  echo "  postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"
}

# =================================================================
# STEP: restore - Restore SQL dump
# =================================================================
step_restore() {
  log "Step: Restoring SQL dump..."

  # Check if dump file exists
  if [ ! -f "$DUMP_FILE" ]; then
    error "Dump file not found: $DUMP_FILE"
    echo ""
    echo "Please transfer your dump to the VPS first:"
    echo "  scp Backup/dump-complet.sql user@your-vps:${APP_DIR}/Backup/"
    echo ""
    echo "Or if you have a JSON dump, convert it first:"
    echo "  node scripts/db-dump.ts  # Generates JSON"
    echo "  # Then import manually via prisma db execute"
    exit 1
  fi

  # Clean the dump (remove Prisma Postgres extensions)
  log "Cleaning dump file (removing Prisma Postgres extensions)..."
  if [ -f "$SCRIPT_DIR/fix-dump-for-local-postgres.sh" ]; then
    DUMP_FILE="$DUMP_FILE" CLEANED_FILE="$CLEANED_DUMP" \
      "$SCRIPT_DIR/fix-dump-for-local-postgres.sh"
  else
    warn "Clean script not found, using dump as-is"
    CLEANED_DUMP="$DUMP_FILE"
  fi

  # Restore to PostgreSQL
  log "Restoring dump to PostgreSQL..."
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
  sudo -u postgres psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";"
  sudo -u postgres psql -d "$DB_NAME" -f "$CLEANED_DUMP"

  success "Dump restored successfully!"
}

# =================================================================
# STEP: migrate - Run Prisma migrations
# =================================================================
step_migrate() {
  log "Step: Running Prisma migrations..."

  DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

  cd "$PROJECT_DIR"

  # Generate Prisma client
  log "Generating Prisma client..."
  DATABASE_URL="$DB_URL" npx prisma generate

  # Run migrations
  log "Applying pending migrations..."
  DATABASE_URL="$DB_URL" npx prisma migrate deploy

  success "Migrations applied successfully!"
}

# =================================================================
# STEP: validate - Validate migration
# =================================================================
step_validate() {
  log "Step: Validating migration..."

  DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

  cd "$PROJECT_DIR"

  # Check table count
  TABLE_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

  log "Tables in database: $TABLE_COUNT"

  # Check if core tables exist
  REQUIRED_TABLES=("User" "Attestation" "Formation" "Exam" "ExamSession" "Settings")
  ALL_OK=true

  for table in "${REQUIRED_TABLES[@]}"; do
    EXISTS=$(sudo -u postgres psql -d "$DB_NAME" -t -c \
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}');" | tr -d ' ')
    if [ "$EXISTS" = "t" ]; then
      success "Table '$table' exists"
    else
      error "Table '$table' MISSING"
      ALL_OK=false
    fi
  done

  # Check Prisma client generation
  if [ -f "$PROJECT_DIR/node_modules/.prisma/client/index.js" ]; then
    success "Prisma client generated"
  else
    warn "Prisma client not found, run: npx prisma generate"
  fi

  if [ "$ALL_OK" = true ]; then
    success "Migration validation PASSED!"
  else
    error "Migration validation FAILED - some tables are missing"
    exit 1
  fi
}

# =================================================================
# STEP: env - Generate .env for VPS
# =================================================================
step_env() {
  log "Step: Generating .env configuration..."

  DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"
  ENV_PATH="${PROJECT_DIR}/.env.vps.generated"

  cat > "$ENV_PATH" <<ENVEOF
# =================================================================
# VPS Environment Configuration
# Generated by migrate-to-vps.sh on $(date '+%Y-%m-%d %H:%M:%S')
# =================================================================

# DATABASE
DATABASE_URL="${DB_URL}"

# AUTHENTICATION (Better Auth)
# IMPORTANT: Generate a new secret for production!
# Run: openssl rand -base64 32
AUTH_SECRET="${AUTH_SECRET:-CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32}"

# BETTER_AUTH configuration
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-${AUTH_SECRET:-CHANGE_ME}}"
BETTER_AUTH_URL="${BETTER_AUTH_URL:-https://your-domain.com}"

# APPLICATION
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://your-domain.com}"
NODE_ENV=production

# REDIS (Upstash - Required for rate limiting)
UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-https://your-project.upstash.io}"
UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-your_token}"

# EMAIL (Resend)
RESEND_API_KEY="${RESEND_API_KEY:-re_your_key}"
RESEND_DOMAIN="${RESEND_DOMAIN:-hashcode.cloud}"
EMAIL_FROM="${EMAIL_FROM:-FSA <noreply@your-domain.com>}"

# PUSHER (Real-time notifications)
PUSHER_APP_ID="${PUSHER_APP_ID:-your_app_id}"
PUSHER_KEY="${PUSHER_KEY:-your_key}"
PUSHER_SECRET="${PUSHER_SECRET:-your_secret}"
PUSHER_CLUSTER="${PUSHER_CLUSTER:-eu}"
NEXT_PUBLIC_PUSHER_KEY="${NEXT_PUBLIC_PUSHER_KEY:-your_key}"
NEXT_PUBLIC_PUSHER_CLUSTER="${NEXT_PUBLIC_PUSHER_CLUSTER:-eu}"

# BOTID (Bot Detection)
BOTID_SECRET="${BOTID_SECRET:-your_secret}"

# DATABASE POOLING (optional, for Prisma Accelerate or PgBouncer)
# DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=5"
ENVEOF

  success "Environment configuration generated: $ENV_PATH"
  echo ""
  warn "IMPORTANT: Review and update the following in $ENV_PATH:"
  echo "  - AUTH_SECRET (generate with: openssl rand -base64 32)"
  echo "  - NEXT_PUBLIC_APP_URL (your production domain)"
  echo "  - UPSTASH_REDIS_REST_URL and TOKEN"
  echo "  - RESEND_API_KEY"
  echo "  - PUSHER credentials"
  echo "  - BOTID_SECRET"
}

# =================================================================
# STEP: full - Run all steps
# =================================================================
step_full() {
  log "Starting full migration..."
  echo ""

  step_setup_db
  echo ""

  step_restore
  echo ""

  step_migrate
  echo ""

  step_validate
  echo ""

  step_env
  echo ""

  success "=========================================="
  success "Migration complete!"
  success "=========================================="
  echo ""
  echo "Next steps:"
  echo "  1. Review the generated .env.vps.generated file"
  echo "  2. Copy it to .env: cp .env.vps.generated .env"
  echo "  3. Fill in missing values (AUTH_SECRET, API keys, etc.)"
  echo "  4. Build the application: pnpm build"
  echo "  5. Start with PM2: pm2 start npm --name attestations-fsa -- start"
  echo "  6. Or use Docker: docker compose -f compose.prod.yml up -d --build"
}

# =================================================================
# Main
# =================================================================
cd "$PROJECT_DIR"

case "$STEP" in
  dump)     step_dump ;;
  setup-db) step_setup_db ;;
  restore)  step_restore ;;
  migrate)  step_migrate ;;
  validate) step_validate ;;
  env)      step_env ;;
  full)     step_full ;;
  *)
    error "Unknown step: $STEP"
    echo "Run with --help for usage information"
    exit 1
    ;;
esac

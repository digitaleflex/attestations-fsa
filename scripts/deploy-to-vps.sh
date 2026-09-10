#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Deploy to VPS (Docker) — Script unifié
# =================================================================
# Dump local → transfert → restore → docker compose up
#
# USAGE:
#   ./scripts/deploy-to-vps.sh
#   ./scripts/deploy-to-vps.sh --skip-dump
#   ./scripts/deploy-to-vps.sh --app-only
#
# Config is read from .env.production
# =================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ── Load .env.production ──────────────────────────────────────────
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
  echo "✅ Loaded .env.production"
else
  echo "❌ .env.production not found!"
  echo "   Copy .env.example to .env.production and fill in your values."
  exit 1
fi

# ── Defaults ──────────────────────────────────────────────────────
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-}"
VPS_PORT="${VPS_PORT:-22}"
VPS_APP_DIR="${VPS_APP_DIR:-/home/audest/attestation-fsa}"
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"
DB_PASSWORD="${DB_PASSWORD:-attestation_fsa_password}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-attestations-fsa-postgres}"
DOCKER_PORT="${DOCKER_PORT:-5433}"

SKIP_DUMP=false
APP_ONLY=false

# ── Parse args ────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --skip-dump) SKIP_DUMP=true ;;
    --app-only)  APP_ONLY=true ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-dump   Skip local dump (use existing SQL)"
      echo "  --app-only    Docker build & restart only (no DB)"
      exit 0
      ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
step() { echo -e "\n${CYAN}${BOLD}═══ $1 ═══${NC}"; }
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
fail() { echo -e "${RED}  ❌ $1${NC}"; exit 1; }

SSH_CMD="ssh -o ConnectTimeout=10 -p $VPS_PORT ${VPS_USER}@${VPS_HOST}"
SCP_CMD="scp -P $VPS_PORT"

# ── Validation ────────────────────────────────────────────────────
[ -z "$VPS_HOST" ] && fail "VPS_HOST manquant dans .env.production"
[ -z "$VPS_USER" ] && fail "VPS_USER manquant dans .env.production"

echo -e "${CYAN}${BOLD}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║   🐳 DEPLOY TO VPS (Docker) — Attestation FSA   ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  VPS: ${VPS_USER}@${VPS_HOST}:${VPS_PORT}                   ║"
echo "║  App: ${VPS_APP_DIR}                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

# =================================================================
# PHASE 1: Export local database
# =================================================================
if [ "$APP_ONLY" = false ] && [ "$SKIP_DUMP" = false ]; then
  step "Phase 1/5 — Export base locale"

  if ! docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
    warn "PostgreSQL Docker non démarré..."
    docker run -d \
      --name "$DOCKER_CONTAINER" \
      -e POSTGRES_USER="$DB_USER" \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB="$DB_NAME" \
      -v attestations-fsa_postgres_data:/var/lib/postgresql/data \
      -p "${DOCKER_PORT}:5432" \
      postgres:17-alpine 2>/dev/null
    sleep 5
    for i in {1..30}; do
      docker exec "$DOCKER_CONTAINER" pg_isready -U "$DB_USER" &>/dev/null && break
      sleep 1
    done
  fi
  ok "PostgreSQL Docker actif"

  DUMP_JSON=$(ls -t Backup/db-dump-*.json 2>/dev/null | head -1)
  [ -z "$DUMP_JSON" ] && fail "Aucun dump JSON dans Backup/"

  log "JSON → SQL..."
  node scripts/json-to-sql.mjs "$DUMP_JSON" > Backup/deploy-dump.sql
  ok "SQL généré ($(wc -l < Backup/deploy-dump.sql) lignes)"
else
  step "Phase 1/5 — Export local (SKIP)"
fi

# =================================================================
# PHASE 2: Transfer to VPS
# =================================================================
if [ "$APP_ONLY" = false ]; then
  step "Phase 2/5 — Transfert vers le VPS"

  log "Test SSH..."
  $SSH_CMD "echo 'SSH OK'" || fail "SSH échoué!"

  log "Création répertoires..."
  $SSH_CMD "mkdir -p ${VPS_APP_DIR}/Backup ${VPS_APP_DIR}/scripts"

  log "Transfert dump SQL..."
  $SCP_CMD Backup/deploy-dump.sql "${VPS_USER}@${VPS_HOST}:${VPS_APP_DIR}/Backup/"
  ok "Dump transféré"

  log "Transfert scripts & configs..."
  for f in scripts/vps-setup-postgres.sh scripts/vps-restore-dump.sh scripts/vps-pre-deploy-backup.sh compose.prod.yml Dockerfile .env.production; do
    [ -f "$f" ] && $SCP_CMD "$f" "${VPS_USER}@${VPS_HOST}:${VPS_APP_DIR}/" 2>/dev/null || true
  done
  $SSH_CMD "chmod +x ${VPS_APP_DIR}/scripts/*.sh 2>/dev/null || true"
  ok "Fichiers transférés"
else
  step "Phase 2/5 — Transfert (SKIP)"
fi

# =================================================================
# PHASE 3: Setup VPS (first deploy)
# =================================================================
if [ "$APP_ONLY" = false ]; then
  step "Phase 3/5 — Setup VPS"

  # Create .env on VPS if missing
  ENV_EXISTS=$($SSH_CMD "test -f ${VPS_APP_DIR}/.env && echo 'yes' || echo 'no'")
  if [ "$ENV_EXISTS" = "no" ]; then
    log "Création du .env sur le VPS..."
    $SSH_CMD "cat > ${VPS_APP_DIR}/.env << ENVEOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@fsa-postgres:5432/${DB_NAME}?sslmode=disable
AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=${NEXT_PUBLIC_APP_URL:-https://your-domain.com}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://your-domain.com}
NODE_ENV=production
UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL:-}
UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN:-}
RESEND_API_KEY=${RESEND_API_KEY:-}
RESEND_DOMAIN=${RESEND_DOMAIN:-hashcode.cloud}
EMAIL_FROM=${EMAIL_FROM:-FSA <noreply@fermestandre.com>}
PUSHER_APP_ID=${PUSHER_APP_ID:-}
PUSHER_KEY=${PUSHER_KEY:-}
PUSHER_SECRET=${PUSHER_SECRET:-}
PUSHER_CLUSTER=${PUSHER_CLUSTER:-eu}
NEXT_PUBLIC_PUSHER_KEY=${NEXT_PUBLIC_PUSHER_KEY:-}
NEXT_PUBLIC_PUSHER_CLUSTER=${NEXT_PUBLIC_PUSHER_CLUSTER:-eu}
BOTID_SECRET=${BOTID_SECRET:-}
TRAEFIK_NETWORK=${TRAEFIK_NETWORK:-proxy}
TRAEFIK_HOST=${TRAEFIK_HOST:-attestations.local}
TRAEFIK_ENTRYPOINT=${TRAEFIK_ENTRYPOINT:-websecure}
TRAEFIK_CERTRESOLVER=${TRAEFIK_CERTRESOLVER:-letsencrypt}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=${DB_NAME}
ENVEOF"
    warn ".env créé — vérifiez les clés API sur le VPS!"
  else
    ok ".env déjà présent"
  fi

  # Docker check
  DOCKER_OK=$($SSH_CMD "docker --version 2>/dev/null && echo 'yes' || echo 'no'")
  if [ "$DOCKER_OK" = "no" ]; then
    log "Installation Docker..."
    $SSH_CMD "curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker"
    ok "Docker installé"
  else
    ok "Docker déjà installé"
  fi

  COMPOSE_OK=$($SSH_CMD "docker compose version 2>/dev/null && echo 'yes' || echo 'no'")
  if [ "$COMPOSE_OK" = "no" ]; then
    $SSH_CMD "apt-get update && apt-get install -y docker-compose-plugin"
    ok "Docker Compose installé"
  else
    ok "Docker Compose déjà installé"
  fi
else
  step "Phase 3/5 — Setup VPS (SKIP)"
fi

# =================================================================
# PHASE 4: Restore data (first deploy only)
# =================================================================
if [ "$APP_ONLY" = false ]; then
  step "Phase 4/5 — Restauration données"

  TABLE_COUNT=$($SSH_CMD "
    docker exec attestations-fsa-postgres-prod psql -U ${DB_USER} -d ${DB_NAME} -t -c \
    \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';\" 2>/dev/null | tr -d ' ' || echo '0'
  ")

  if [ "$TABLE_COUNT" -lt 5 ] 2>/dev/null; then
    log "Base vide. Démarrage PostgreSQL..."
    $SSH_CMD "cd ${VPS_APP_DIR} && docker compose -f compose.prod.yml up -d fsa-postgres"
    sleep 5

    log "Restauration du dump..."
    $SSH_CMD "cd ${VPS_APP_DIR} && \
      docker exec -i attestations-fsa-postgres-prod \
      psql -U ${DB_USER} -d ${DB_NAME} < Backup/deploy-dump.sql 2>&1 | tail -5"
    ok "Données restaurées"
  else
    ok "Base OK (${TABLE_COUNT} tables)"
  fi
else
  step "Phase 4/5 — Restauration (SKIP)"
fi

# =================================================================
# PHASE 5: Docker build & restart
# =================================================================
step "Phase 5/5 — Docker build & restart"

log "Réseau proxy Traefik (idempotent)..."
$SSH_CMD "docker network inspect ${TRAEFIK_NETWORK:-proxy} >/dev/null 2>&1 || docker network create ${TRAEFIK_NETWORK:-proxy}"

log "Arrêt anciens conteneurs..."
$SSH_CMD "cd ${VPS_APP_DIR} && docker compose -f compose.prod.yml down 2>/dev/null || true"

log "Build & démarrage..."
$SSH_CMD "cd ${VPS_APP_DIR} && docker compose -f compose.prod.yml up -d --build"

log "Attente démarrage..."
sleep 10

STATUS=$($SSH_CMD "docker compose -f ${VPS_APP_DIR}/compose.prod.yml ps --format '{{.Status}}' 2>/dev/null || echo 'unknown'")
if echo "$STATUS" | grep -qi "up\|running"; then
  ok "Conteneurs actifs"
else
  warn "Vérifiez: docker compose -f compose.prod.yml logs"
fi

# =================================================================
# DONE
# =================================================================
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║   ✅ DÉPLOIEMENT DOCKER TERMINÉ !               ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  🌐 URL  : http://${VPS_HOST}:3000                ║"
echo "║  🐳 Docker: compose.prod.yml                     ║"
echo "║  📦 DB   : PostgreSQL (container)                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

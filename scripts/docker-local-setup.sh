#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Full local Docker setup for testing VPS migration
# - Starts PostgreSQL in Docker
# - Cleans the dump for standard PostgreSQL
# - Restores the dump
# - Runs prisma migrate deploy
# =================================================================

cd "$(dirname "$0")/.."

echo "==> Starting PostgreSQL container..."
docker compose -f compose.local.yml down -v 2>/dev/null || true
docker compose -f compose.local.yml up -d postgres

echo "==> Waiting for PostgreSQL to be healthy..."
docker compose -f compose.local.yml exec -T postgres sh -c '
  until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
    echo "Waiting for database..."
    sleep 1
  done
'

echo "==> Cleaning dump for standard PostgreSQL..."
./scripts/fix-dump-for-local-postgres.sh

echo "==> Restoring dump to local PostgreSQL..."
./scripts/docker-local-restore.sh

echo "==> Running Prisma migrations..."
./scripts/docker-local-migrate.sh

echo ""
echo "==> Local setup complete!"
echo "Database URL (from host): postgresql://attestation_fsa_user:attestation_fsa_password@localhost:5432/attestation_fsa?sslmode=disable"
echo "Note: on Windows Docker Desktop, some PostgreSQL clients (like node-postgres) may have issues with localhost port forwarding."
echo "Use the 'prisma' service for migrations: docker compose -f compose.local.yml run --rm prisma migrate deploy"

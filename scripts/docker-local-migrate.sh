#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Run Prisma migrations against the local Docker PostgreSQL
# Builds a dedicated Prisma CLI image to avoid cross-platform issues
# =================================================================

cd "$(dirname "$0")/.."

DB_URL="postgresql://attestation_fsa_user:attestation_fsa_password@postgres:5432/attestation_fsa?sslmode=disable"

echo "==> Building Prisma CLI Docker image..."
MSYS_NO_PATHCONV=1 docker build -f Dockerfile.prisma -t attestations-fsa-prisma .

echo "==> Running prisma migrate deploy inside Docker network..."
MSYS_NO_PATHCONV=1 docker run --rm \
  --network attestations-fsa_attestations-fsa-network \
  -e DATABASE_URL="$DB_URL" \
  attestations-fsa-prisma migrate deploy

echo "==> Migration complete."

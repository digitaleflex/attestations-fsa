#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Import JSON dump to PostgreSQL (via Docker exec)
# =================================================================
# This script imports data from the JSON dump (db-dump-*.json)
# into a PostgreSQL database running in Docker.
#
# USAGE:
#   ./scripts/import-json-to-postgres.sh [dump-file]
# =================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
CONTAINER_NAME="${CONTAINER_NAME:-attestations-fsa-postgres}"
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✅]${NC} $1"; }
warn() { echo -e "${YELLOW}[⚠️]${NC} $1"; }
error() { echo -e "${RED}[❌]${NC} $1"; }

cd "$PROJECT_DIR"

# Find dump file
DUMP_FILE="${1:-}"
if [ -z "$DUMP_FILE" ]; then
  DUMP_FILE=$(ls -t Backup/db-dump-*.json 2>/dev/null | head -1)
  if [ -z "$DUMP_FILE" ]; then
    error "No JSON dump file found in Backup/"
    exit 1
  fi
fi

if [ ! -f "$DUMP_FILE" ]; then
  error "Dump file not found: $DUMP_FILE"
  exit 1
fi

log "Using dump file: $DUMP_FILE"

# Check if PostgreSQL container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  error "PostgreSQL container '$CONTAINER_NAME' is not running."
  echo "Start it with:"
  echo "  docker compose -f compose.local.yml up -d postgres"
  exit 1
fi

# Check if PostgreSQL is ready
if ! docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
  warn "PostgreSQL is not ready. Waiting..."
  for i in {1..30}; do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
      break
    fi
    sleep 1
  done
fi

log "PostgreSQL is ready!"

# Copy dump file to container
log "Copying dump file to container..."
docker cp "$DUMP_FILE" "${CONTAINER_NAME}:/tmp/import-dump.json"

# Create import script inside container
log "Creating import script..."
docker exec "$CONTAINER_NAME" bash -c 'cat > /tmp/import.mjs << '\''NODESCRIPT'\''
import fs from "fs";
import pg from "pg";

const { Pool } = pg;

const dump = JSON.parse(fs.readFileSync("/tmp/import-dump.json", "utf8"));
console.log("Loaded dump:", dump.exportedAt);
console.log("Counts:", dump.counts);

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "attestation_fsa_user",
  password: process.env.POSTGRES_PASSWORD || "attestation_fsa_password",
  database: "attestation_fsa",
});

const client = await pool.connect();

const tableOrder = [
  { table: "User", data: dump.tables.users, fields: ["id","name","email","emailVerified","image","role","createdAt","updatedAt","banned","banReason","banExpires","address","birthDate","birthPlace","phone","attestationCode","attestationStatus","enrolledAt","examId","examScheduledAt","formationId","gender","blockedReason","lastBlockedAt","resetPasswordRequired","status"] },
  { table: "Account", data: dump.tables.accounts, fields: ["id","userId","scope","accessToken","accessTokenExpiresAt","accountId","createdAt","idToken","providerId","refreshToken","refreshTokenExpiresAt","updatedAt"] },
  { table: "Session", data: dump.tables.sessions, fields: ["id","userId","createdAt","expiresAt","ipAddress","updatedAt","userAgent","impersonatedBy"] },
  { table: "Verification", data: dump.tables.verifications, fields: ["id","identifier","value","expiresAt","createdAt","updatedAt"] },
  { table: "Formation", data: dump.tables.formations, fields: ["id","name","category","description","skills","createdAt"] },
  { table: "Settings", data: dump.tables.settings, fields: ["id","institutionName","replyTo","updatedAt","targetAttestations","targetInscriptions","targetValidations","institutionLogo","instructorName","instructorTitle","location","signatureUrl","supportEmail"] },
  { table: "Report", data: dump.tables.reports, fields: ["id","codeAttestation","motif","message","email","createdAt","status"] },
  { table: "Contact", data: dump.tables.contacts, fields: ["id","name","email","phone","subject","message","status","type","createdAt","updatedAt"] },
  { table: "Exam", data: dump.tables.exams, fields: ["id","title","description","status","totalPoints","createdAt","updatedAt","formationId","duration","name","part1Enabled","part1Points","part1Questions","part2Enabled","part2Points","part2Questions","part3Enabled","part3Mode","part3Points","part3Subject","passingScore","randomizeQuestions","showResults","scheduledAt","session","type"] },
  { table: "ExamPart", data: dump.tables.examParts, fields: ["id","examId","title","type","duration","points","order","scenario"] },
  { table: "Attestation", data: dump.tables.attestations, fields: ["id","code","issuedAt","type","fullName","email","birthDate","birthPlace","formationId","startDate","endDate","location","instructor","issuingCompany","status","pdfUrl","certificationHours","certificationMention","certificationObservations","certificationScore","gender","stageHours","stageObservations","stageScore","userId"] },
  { table: "ExamSession", data: dump.tables.examSessions, fields: ["id","examId","userId","status","scorePart1","scorePart2","scorePart3","score","totalScore","internshipScore","finalScore","gradedBy","gradedAt","startedAt","submittedAt","updatedAt","answers","type",] },
  { table: "InternshipRequest", data: dump.tables.internshipRequests, fields: ["id","fullName","email","phone","university","level","position","cvUrl","message","status","createdAt","updatedAt","userId"] },
  { table: "CorrectionRequest", data: dump.tables.correctionRequests, fields: ["id","userId","attestationId","field","oldValue","newValue","reason","status","createdAt","updatedAt"] },

  { table: "AuditLog", data: dump.tables.auditLogs, fields: ["id","userId","action","resource","resourceId","oldValue","newValue","ipAddress","timestamp"] },
  { table: "Notification", data: dump.tables.notifications, fields: ["id","userId","type","title","message","isRead","link","metadata","createdAt"] },
  { table: "Reclamation", data: dump.tables.reclamations, fields: ["id","userId","submissionId","subject","message","status","adminReply","createdAt","updatedAt"] },
  { table: "Question", data: dump.tables.questions, fields: ["id","partId","text","type","points","order"] },
  { table: "QuestionOption", data: dump.tables.questionOptions, fields: ["id","questionId","text","isCorrect","feedback"] },

];

console.log("\nStarting import...\n");
let total = 0, errors = 0;

for (const { table, data, fields } of tableOrder) {
  if (!data || data.length === 0) { console.log("  Skip " + table + " (empty)"); continue; }
  try {
    await client.query("DELETE FROM \"" + table + "\"");
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      for (const row of batch) {
        const values = fields.map(f => row[f] ?? null);
        const ph = fields.map((_, i) => "$" + (i + 1));
        await client.query("INSERT INTO \"" + table + "\" (" + fields.map(f => "\"" + f + "\"").join(", ") + ") VALUES (" + ph.join(", ") + ") ON CONFLICT (id) DO NOTHING", values);
      }
      total += batch.length;
    }
    console.log("  ✅ " + table + ": " + data.length);
  } catch (err) {
    console.error("  ❌ " + table + ": " + err.message);
    errors++;
  }
}

console.log("\n==========================================");
console.log("Import complete! Total:", total, "rows, Errors:", errors);
console.log("==========================================");

client.release();
await pool.end();
NODESCRIPT
'

# Install pg module inside container and run import
log "Installing pg module and running import..."
docker exec "$CONTAINER_NAME" sh -c '
  cd /tmp
  npm init -y --silent 2>/dev/null
  npm install pg --silent 2>/dev/null
  node /tmp/import.mjs
'

# Clean up temp files in container
docker exec "$CONTAINER_NAME" rm -f /tmp/import-dump.json /tmp/import.mjs

# Verify import
log "Verifying import..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC;
"

success "Import complete!"
echo ""
echo "Next steps:"
echo "  1. Run Prisma migrations: npx prisma migrate deploy"
echo "  2. Generate Prisma client: npx prisma generate"
echo "  3. Test the application: pnpm dev"

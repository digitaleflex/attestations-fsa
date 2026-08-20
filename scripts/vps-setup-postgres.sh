#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Setup PostgreSQL 17 on Ubuntu/Debian VPS
# Run this script once on your VPS as root or with sudo
# =================================================================

DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: DB_PASSWORD must be set."
  echo "Usage: DB_PASSWORD='your_secure_password' ./scripts/vps-setup-postgres.sh"
  exit 1
fi

echo "==> Updating packages..."
apt-get update && apt-get upgrade -y

echo "==> Installing PostgreSQL 17..."
# Add official PostgreSQL APT repository
install -d /usr/share/postgresql-common/pgdg
curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
apt-get update
apt-get install -y postgresql-17 postgresql-client-17

echo "==> Configuring PostgreSQL..."
# Listen only on localhost (no external exposure)
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" /etc/postgresql/17/main/postgresql.conf

# Restart PostgreSQL
systemctl restart postgresql
systemctl enable postgresql

echo "==> Creating database and user..."
sudo -u postgres psql <<EOF
CREATE USER "$DB_USER" WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE "$DB_NAME" OWNER "$DB_USER";
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";
ALTER USER "$DB_USER" WITH SUPERUSER;
EOF

echo "==> PostgreSQL setup complete."
echo ""
echo "Add this to your /home/audest/attestation-fsa/.env:"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?sslmode=disable"

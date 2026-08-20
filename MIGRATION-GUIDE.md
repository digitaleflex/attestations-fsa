# 🚀 Guide de Migration : Prisma Postgres → PostgreSQL Self-hosted

Ce guide détaille la migration complète de la base de données **Prisma Postgres** vers un **PostgreSQL self-hosté** sur votre VPS.

---

## 📋 Prérequis

| Composant | Requis | Notes |
|-----------|--------|-------|
| VPS Ubuntu/Debian | ✅ | Accès SSH avec permissions root/sudo |
| Dump SQL de la DB | ✅ | Export depuis Prisma Postgres |
| Espace disque | ≥ 2 GB | Pour PostgreSQL + backups |
| RAM | ≥ 1 GB | Pour PostgreSQL + Next.js |

---

## 🔧 Étape 1 : Exporter la base de données

### Option A : Via le dashboard Prisma (Recommandé)

1. Connectez-vous à [database.prisma.io](https://database.prisma.io)
2. Sélectionnez votre projet
3. Utilisez la fonction **Export/Backup** pour télécharger un dump SQL
4. Sauvegardez le fichier comme `Backup/dump-complet.sql`

### Option B : Via pg_dump (si accès direct)

```bash
# Extraire l'URL de connexion réelle depuis le dashboard Prisma
pg_dump "postgresql://user:pass@host:5432/db" > Backup/dump-complet.sql
```

### Option C : Via le script JSON (fallback)

```bash
# Si Prisma Postgres est encore accessible
DB_URL="prisma+postgres://..." npx ts-node scripts/db-dump.ts
# Génère Backup/db-dump-XXXXXXXXX.json
```

> ⚠️ Le dump JSON nécessite une conversion manuelle via Prisma Studio ou un script d'import.

---

## 📦 Étape 2 : Transférer le dump vers le VPS

```bash
# Depuis votre machine locale
scp Backup/dump-complet.sql user@your-vps:/home/audest/attestation-fsa/Backup/
```

---

## 🛠️ Étape 3 : Exécuter la migration sur le VPS

### Méthode automatique (recommandé)

```bash
cd /home/audest/attestation-fsa

# Rendre le script exécutable
chmod +x scripts/migrate-to-vps.sh

# Exécuter la migration complète
DB_PASSWORD='votre_mot_de_passe_securise' ./scripts/migrate-to-vps.sh --step=full
```

Le script va :
1. ✅ Installer PostgreSQL 17
2. ✅ Créer la base de données et l'utilisateur
3. ✅ Nettoyer le dump (supprimer les extensions Prisma Postgres)
4. ✅ Restaurer les données
5. ✅ Appliquer les migrations Prisma en attente
6. ✅ Valider l'intégrité
7. ✅ Générer le fichier `.env.vps.generated`

### Méthode manuelle (étape par étape)

```bash
# 1. Installer PostgreSQL
sudo apt update && sudo apt install -y postgresql postgresql-client

# 2. Configurer PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. Créer la base et l'utilisateur
sudo -u postgres psql <<SQL
CREATE USER "attestation_fsa_user" WITH PASSWORD 'votre_mot_de_passe';
CREATE DATABASE "attestation_fsa" OWNER "attestation_fsa_user";
GRANT ALL PRIVILEGES ON DATABASE "attestation_fsa" TO "attestation_fsa_user";
ALTER USER "attestation_fsa_user" WITH SUPERUSER;
SQL

# 4. Nettoyer le dump
./scripts/fix-dump-for-local-postgres.sh

# 5. Restaurer le dump
sudo -u postgres psql -d attestation_fsa -f Backup/dump-complet-clean.sql

# 6. Configurer DATABASE_URL dans .env
echo 'DATABASE_URL="postgresql://attestation_fsa_user:votre_mot_de_passe@localhost:5432/attestation_fsa?sslmode=disable"' >> .env

# 7. Appliquer les migrations Prisma
npx prisma generate
npx prisma migrate deploy
```

---

## ⚙️ Étape 4 : Configurer l'environnement

```bash
# Copier le template
cp .env.vps.example .env

# Éditer avec vos valeurs
nano .env
```

### Variables critiques à remplir

| Variable | Description | Générer avec |
|----------|-------------|--------------|
| `DATABASE_URL` | URL PostgreSQL | Fournie par le script |
| `AUTH_SECRET` | Secret Better Auth | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | URL publique | `https://votre-domaine.com` |
| `NEXT_PUBLIC_APP_URL` | URL publique | `https://votre-domaine.com` |
| `UPSTASH_REDIS_REST_URL` | Redis Upstash | Dashboard Upstash |
| `RESEND_API_KEY` | Clé Resend | Dashboard Resend |

---

## 🐳 Étape 5 : Déploiement

### Option A : PM2 (recommandé)

```bash
cd /home/audest/attestation-fsa

# Installer PM2 globalement
npm install -g pm2

# Build l'application
pnpm install --frozen-lockfile
npx prisma generate
pnpm build

# Démarrer avec PM2
pm2 start npm --name "attestation-fsa" -- start
pm2 save
pm2 startup  # Pour démarrage automatique
```

### Option B : Docker Compose

```bash
cd /home/audest/attestation-fsa

# Avec PostgreSQL intégré
docker compose -f compose.prod.yml up -d --build

# Ou avec PostgreSQL sur le VPS (hors Docker)
# Modifier compose.prod.yml pour commenter le service postgres
# et pointer DATABASE_URL vers localhost
docker compose -f compose.prod.yml up -d --build app
```

---

## 🔍 Étape 6 : Validation

```bash
# Vérifier les tables
sudo -u postgres psql -d attestation_fsa -c "\dt"

# Vérifier les migrations
npx prisma migrate status

# Tester l'application
curl http://localhost:3000

# Vérifier les logs
pm2 logs attestations-fsa
# ou
docker compose -f compose.prod.yml logs -f app
```

---

## 🔄 Étape 7 : Configuration GitHub Actions

Mettez à jour les secrets dans **Settings → Secrets → Actions** :

| Secret | Valeur |
|--------|--------|
| `VPS_HOST` | IP du VPS |
| `VPS_USER` | Utilisateur SSH |
| `VPS_SSH_KEY` | Clé SSH privée |
| `VPS_PORT` | Port SSH (défaut: 22) |

Le workflow `deploy.yml` se déclenchera automatiquement sur push à `main`.

---

## 🛡️ Sécurité Post-Migration

### 1. Restreindre l'accès PostgreSQL

```bash
# Éditer pg_hba.conf
sudo nano /etc/postgresql/17/main/pg_hba.conf

#garder uniquement les connexions locales
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     peer
host    attestation_fsa attestation_fsa_user  127.0.0.1/32    md5
host    attestation_fsa attestation_fsa_user  ::1/128         md5
```

### 2. Activer SSL (optionnel mais recommandé)

```bash
# Générer un certificat auto-signé
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/postgresql.key \
  -out /etc/ssl/certs/postgresql.crt \
  -subj "/CN=localhost"

# PostgreSQL conf
sudo nano /etc/postgresql/17/main/postgresql.conf
# ssl = on
# ssl_cert_file = '/etc/ssl/certs/postgresql.crt'
# ssl_key_file = '/etc/ssl/private/postgresql.key'

sudo systemctl restart postgresql
```

### 3. Configurer les backups automatiques

```bash
# Ajouter au crontab
crontab -e

# Backup quotidien à 3h du matin
0 3 * * * cd /home/audest/attestation-fsa && DB_NAME=attestation_fsa ./scripts/vps-pre-deploy-backup.sh
```

---

## 🐛 Dépannage

### Erreur: `password authentication failed`

```bash
# Vérifier le mot de passe dans pg_hba.conf
sudo grep -n "md5\|scram-sha-256\|peer" /etc/postgresql/17/main/pg_hba.conf

# Réinitialiser le mot de passe
sudo -u postgres psql -c "ALTER USER attestation_fsa_user WITH PASSWORD 'new_password';"
```

### Erreur: `relation "Admin" does not exist`

```bash
# Les migrations en attente n'ont pas été appliquées
npx prisma migrate deploy
```

### Erreur: `prisma_postgres extension does not exist`

```bash
# Le dump n'a pas été nettoyé
./scripts/fix-dump-for-local-postgres.sh
# Puis restaurer à nouveau
sudo -u postgres psql -d attestation_fsa -f Backup/dump-complet-clean.sql
```

### Erreur: `ECONNREFUSED localhost:5432`

```bash
# Vérifier que PostgreSQL est en cours d'exécution
sudo systemctl status postgresql
sudo systemctl start postgresql
```

---

## 📊 Vérification Finale

```bash
# Test complet
curl -s http://localhost:3000 | head -5

# Vérifier la base de données
sudo -u postgres psql -d attestation_fsa -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## ✅ Checklist Post-Migration

- [ ] PostgreSQL installé et configuré
- [ ] Base de données restaurée
- [ ] Migrations Prisma appliquées
- [ ] `.env` configuré avec toutes les variables
- [ ] Application buildée (`pnpm build`)
- [ ] Application démarrée (PM2 ou Docker)
- [ ] Tests de connexion réussis
- [ ] Backups automatiques configurés
- [ ] GitHub Actions secrets configurés
- [ ] SSL activé (optionnel)
- [ ] Ancien Prisma Postgres désactivé/désabonné

---

> 📝 **Note** : Ce guide suppose une migration depuis Prisma Postgres vers PostgreSQL 17 sur Ubuntu/Debian. Adaptez les commandes si vous utilisez une autre distribution.

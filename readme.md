# 🐟 Attestation Tracker — FSA

**Ferme Agropiscicole St André** — Plateforme de gestion des attestations, examens et certifications.

---

## 🎯 À propos

Application web complète pour numériser et structurer la gestion des attestations délivrées par la FSA dans le cadre de ses activités de formation, stages et certification.

**Stack technique :**

```
Next.js 16 (App Router) + TypeScript
├── TailwindCSS + Radix UI
├── React Hook Form + Zod
├── Prisma + PostgreSQL
├── Better Auth (sessions + 2FA)
├── Pusher (temps réel)
├── Resend (emails)
├── Upstash Redis (rate limiting)
└── Docker (containérisation)
```

---

## 📦 Installation

### Prérequis

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://docker.com/) (optionnel, pour PostgreSQL)
- [PostgreSQL](https://postgresql.org/) 17 (ou Docker)

### 1. Cloner et installer

```bash
git clone https://github.com/your-org/attestations-fsa.git
cd attestations-fsa
pnpm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Modifier le fichier `.env` :

```env
# Base de données (Docker ou distant)
DATABASE_URL="postgresql://attestation_fsa_user:password@localhost:5433/attestation_fsa?sslmode=disable"

# Auth
AUTH_SECRET="generer_avec_openssl_rand_base64_32"
BETTER_AUTH_SECRET="generer_avec_openssl_rand_base64_32"
BETTER_AUTH_URL="http://localhost:3000"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV=development
```

### 3. Démarrer PostgreSQL (Docker)

```bash
# PostgreSQL dans Docker sur le port 5433
docker run -d \
  --name attestations-fsa-postgres \
  -e POSTGRES_USER=attestation_fsa_user \
  -e POSTGRES_PASSWORD=attestation_fsa_password \
  -e POSTGRES_DB=attestation_fsa \
  -v attestations-fsa_postgres_data:/var/lib/postgresql/data \
  -p 5433:5432 \
  postgres:17-alpine
```

> ⚠️ Le port **5433** est utilisé pour éviter les conflits avec PostgreSQL natif (Laragon/XAMPP sur 5432).

### 4. Initialiser la base de données

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Lancer l'application

```bash
pnpm dev
```

L'app est accessible sur [http://localhost:3000](http://localhost:3000).

---

## 🚀 Déploiement sur VPS (Docker)

### Prérequis

- Un VPS Ubuntu/Debian avec accès SSH
- Docker et Docker Compose installés sur le VPS
- Connexion SSH configurée (clé SSH)

### Configuration

Copier et modifier le fichier de déploiement :

```bash
cp .env.deploy.example .env.deploy
nano .env.deploy
```

Remplir les valeurs :

```env
VPS_HOST=192.168.1.100        # IP de votre VPS
VPS_USER=root                  # Utilisateur SSH
VPS_PORT=22                    # Port SSH
VPS_APP_DIR=/home/audest/attestation-fsa
DB_PASSWORD=votre_mot_de_passe_securise
```

### Déploiement complet (1ère fois)

```bash
./scripts/deploy-to-vps.sh
```

Ce script fait **automatiquement** :

1. **Export** — Génère le dump SQL depuis la base locale
2. **Transfert** — Envoie le dump + scripts vers le VPS via SSH
3. **Install** — Installe Docker + PostgreSQL sur le VPS
4. **Restore** — Restaure les données dans PostgreSQL
5. **Build** — `docker compose up -d --build`

### Déploiements futurs

```bash
# Juste rebuild et redémarrer (pas de base de données)
./scripts/deploy-to-vps.sh --app-only

# Avec dump déjà fait
./scripts/deploy-to-vps.sh --skip-dump
```

### Via GitHub Actions

Le workflow se déclenche automatiquement sur push à `main` :

```bash
git push origin main
```

Le workflow détecte si la DB est vide et restaure le dump automatiquement.

---

## 🐳 Architecture Docker

### Conteneurs

| Conteneur | Rôle | Port |
|-----------|------|------|
| `attestations-fsa-prod` | Application Next.js | 3000 |
| `attestations-fsa-postgres-prod` | PostgreSQL 17 | 5432 (interne) |

### Commandes Docker

```bash
# Voir les conteneurs
docker compose -f compose.prod.yml ps

# Voir les logs
docker compose -f compose.prod.yml logs -f

# Redémarrer
docker compose -f compose.prod.yml restart

# Arrêter
docker compose -f compose.prod.yml down

# Rebuild complet
docker compose -f compose.prod.yml up -d --build
```

---

## 📁 Structure du projet

```
attestations-fsa/
├── app/                          # Routes Next.js (App Router)
│   ├── (public)/                 # Pages publiques
│   │   ├── formations/           # Catalogue formations
│   │   ├── verifier/             # Vérification attestation
│   │   ├── faq/                  # FAQ
│   │   └── contact/              # Contact
│   ├── (user)/                   # Espace candidat
│   │   ├── dashboard/            # Tableau de bord
│   │   ├── exams/                # Passage d'examens
│   │   ├── attestations/         # Mes attestations
│   │   └── profile/              # Mon profil
│   ├── admin/                    # Backoffice admin
│   │   ├── dashboard/            # Stats admin
│   │   ├── users/                # Gestion utilisateurs
│   │   ├── formations/           # Gestion formations
│   │   ├── exams/                # Gestion examens
│   │   ├── attestations/         # Gestion attestations
│   │   ├── corrections/          # Corrections manuelles
│   │   └── logs/                 # Audit logs
│   ├── api/                      # Routes API
│   │   ├── auth/                 # Authentification
│   │   ├── admin/                # API admin
│   │   ├── exams/                # API examens
│   │   └── public/               # API publique
│   └── p/                        # Portfolios publics
├── components/                   # Composants React
├── lib/                          # Utilitaires
│   ├── auth.ts                   # Better Auth config
│   ├── prisma.ts                 # Client Prisma
│   ├── email.ts                  # Envoi emails (Resend)
│   ├── pusher.ts                 # Temps réel (Pusher)
│   └── rate-limit.ts             # Rate limiting (Upstash)
├── prisma/
│   ├── schema.prisma             # Modèle de données
│   └── migrations/               # Migrations SQL
├── scripts/
│   ├── deploy-to-vps.sh          # Script de déploiement
│   ├── json-to-sql.mjs          # Convertisseur JSON → SQL
│   ├── export-docker-volume.sh   # Export volume Docker
│   └── vps-*.sh                  # Scripts VPS
├── compose.prod.yml              # Docker Compose production
├── compose.local.yml             # Docker Compose développement
├── Dockerfile                    # Build multi-stage
└── .env.deploy                   # Config déploiement
```

---

## 🗃 Base de données

### Tables principales

| Table | Description |
|-------|-------------|
| `User` | Utilisateurs (admin + candidats) |
| `Formation` | Catalogue des formations |
| `Attestation` | Attestations délivrées |
| `Exam` | Examens (QCM + parties ouvertes) |
| `ExamSession` | Sessions de passage d'examen |
| `Settings` | Configuration institution |
| `AuditLog` | Journal d'audit |
| `Notification` | Notifications utilisateurs |

### Format code attestation

```
FSA-2025-M07-00012-3f8b6
│    │    │   │     └── Hash court (nanoid)
│    │    │   └──────── Numéro séquentiel
│    │    └──────────── Mois
│    └───────────────── Année
└────────────────────── Acronyme ferme
```

### Statuts

- `PENDING` — En attente de validation
- `VALIDATED` — Attestation validée
- `REJECTED` — Refusée
- `CLAIMED` — Réclamée par le bénéficiaire

---

## 🔐 Sécurité

- **Auth** : Better Auth avec sessions sécurisées
- **2FA** : TOTP + Email + Codes de secours (admins)
- **Rate Limiting** : Upstash Redis
- **Middleware** : Protection des routes admin/user
- **Audit** : Logs de toutes les actions sensibles
- **Validation** : Zod côté client et serveur

---

## 🔧 Scripts utiles

```bash
# Générer un dump JSON de la base
node scripts/db-dump.ts

# Convertir le dump JSON en SQL
node scripts/json-to-sql.mjs Backup/db-dump-XXXXX.json > Backup/dump.sql

# Exporter le volume Docker
./scripts/export-docker-volume.sh

# Déployer sur le VPS
./scripts/deploy-to-vps.sh

# Déploiement rapide (app only)
./scripts/deploy-to-vps.sh --app-only
```

---

## 📋 Checklist de déploiement

### Premier déploiement

- [ ] VPS accessible en SSH
- [ ] `.env.deploy` configuré avec la bonne IP
- [ ] Dump JSON dans `Backup/db-dump-*.json`
- [ ] Lancer `./scripts/deploy-to-vps.sh`
- [ ] Vérifier l'app sur `http://VPS_IP:3000`

### Déploiements suivants

- [ ] Push sur `main` (ou `./scripts/deploy-to-vps.sh --app-only`)
- [ ] Vérifier les logs : `docker compose -f compose.prod.yml logs -f`

---

## 📝 Licence

Projet privé — Ferme Agropiscicole St André.

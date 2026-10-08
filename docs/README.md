# Documentation de la plateforme FSA (Ferme Agro-Piscicole Cité St André)

Bienvenue dans la documentation officielle de la plateforme d'attestations et d'évaluation de la **Ferme St André (FSA)**.

---

## 🎯 Présentation Générale

La plateforme FSA est une application web moderne conçue pour gérer, générer, et vérifier de manière sécurisée les attestations de formation, de stage et de certification de la Ferme Cité St André.

### Fonctionnalités Clés :
- **Génération d'Attestations** : Création et émission automatique de diplômes PDF sécurisés et signés numériquement.
- **Passage d'Examens** : Moteur d'évaluation en temps réel (QCM, questions ouvertes, études de cas) avec détection automatique de triche.
- **Espace Candidat** : Dashboard optimisé en un seul point d'entrée pour suivre sa progression, passer des examens et récupérer ses documents.
- **Backoffice Admin** : Gestion complète des utilisateurs, des formations, corrections manuelles, notifications temps réel et logs d'audit.
- **Vérification Publique** : Outil public de vérification instantanée des attestations par code unique ou QR Code.

---

## 🚀 Guide de Démarrage Rapide (Quick Start)

### Prérequis
- **Node.js** >= 18.x
- **npm** >= 9.x (ou pnpm)
- Base de données **PostgreSQL** active

### Installation et Lancement local

```bash
# 1. Cloner le dépôt
git clone https://github.com/digitaleflex/attestations-fsa.git
cd attestations-fsa

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Ouvrez .env et renseignez vos clés d'accès (DATABASE_URL, BETTER_AUTH_SECRET, etc.)

# 4. Appliquer le schéma de base de données
npx prisma generate
npx prisma migrate dev

# 5. Remplir la base de données avec des données de test
npm run seed

# 6. Lancer le serveur de développement
npm run dev
```

### URLs d'Accès local
- **Portail Candidat / Public** : `http://localhost:3000`
- **Portail Administration** : `http://localhost:3000/admin/login`

---

## 📂 Structure Réelle du Projet

L'arborescence suit l'architecture standard de Next.js (App Router) :

```
attestations-fsa/
├── app/               # Routes des pages Next.js (Router App) et points d'accès API
│   ├── (public)/      # Pages vitrines publiques (Accueil, CGU, CGV)
│   ├── (user)/        # Espace personnel et Dashboard candidat
│   ├── admin/         # Backoffice complet de gestion administrative
│   └── api/           # Endpoints d'API REST (User, Admin, Public, Auth)
├── components/        # Composants UI React (Radix UI, Tailwind CSS)
├── hooks/             # Hooks React personnalisés (anti-triche, timer, etc.)
├── lib/               # Code partagé (client Prisma, configuration Better Auth, utilitaires)
├── prisma/            # Schéma de base de données relationnelle et scripts de peuplement (seed)
├── public/            # Ressources statiques (images, logos, polices, fichiers publics)
├── docs/              # Fichiers de documentation unifiée
├── package.json       # Scripts npm et dépendances du projet
└── tsconfig.json      # Configuration du compilateur TypeScript
```

---

## 📊 Inventaire Fonctionnel & Progression du Projet

La plateforme FSA est structurée en modules fonctionnels indépendants et hautement sécurisés :

> ⚠️ **Réaligné le 2026-09-16 (issue #86)** : les modules **Waitlist**, **Ressources
> pédagogiques** et **Chat** (ainsi que **Portfolio** et **Annuaire**) ont été retirés
> du produit le 2026-06-22 (commit `960852f`). Ils figurent ci-dessous avec leur statut
> réel ; les pourcentages restants sont un instantané d'avril 2026 non recalculé.

| Module | Progression | Statut | Documentation |
|--------|-------------|--------|---------------|
| 🔐 Authentification (Better Auth) | 100% | ✅ Complet | [docs/AUTH-COMPTES.md](AUTH-COMPTES.md) |
| 🛡️ Sécurité & Anti-Triche | 95% | ✅ Complet | [docs/ANTI_CHEAT_SYSTEM.md](ANTI_CHEAT_SYSTEM.md) |
| 📊 Dashboard Admin | 95% | ✅ Complet | [docs/admin-dashboard/01-tableau-bord.md](admin-dashboard/01-tableau-bord.md) |
| 🌐 Pages Publiques | 90% | ✅ Complet | [docs/public-pages/01-pages-publiques.md](public-pages/01-pages-publiques.md) |
| 📝 Gestion des Examens | 90% | ✅ Complet | [docs/exam-management/01-creation-examens.md](exam-management/01-creation-examens.md) |
| 📜 Gestion des Attestations | % hérité d'avril 2026, non recalculé — à vérifier | ⚠️ À vérifier (CI et staging présents ; Sentry supprimé ; uptime externe : TODO humain) | [docs/attestation-management/01-creation-attestations.md](attestation-management/01-creation-attestations.md) |
| ⏳ Waitlist d'inscription | — | 🗑️ Retiré (2026-06-22, `960852f`) | Module supprimé du produit : aucun modèle Prisma, aucune page, aucune API. |
| 🎓 Résultats & Transcripts | 80% | ✅ Complet | [docs/results-transcripts/01-consultation-resultats.md](results-transcripts/01-consultation-resultats.md) |
| ✏️ Demandes de Correction | 80% | ✅ Complet | Permet aux candidats de modifier leurs données personnelles d'identité sous validation admin. |
| 💼 Gestion des Stages | 75% | ⚠️ Améliorable | [docs/internship-management/01-demandes-stage.md](internship-management/01-demandes-stage.md) |
| 📚 Ressources pédagogiques | — | 🗑️ Retiré (2026-06-22, `960852f`) + docs supprimées (#67) | Module supprimé du produit. |
| 🔔 Notifications (Pusher) | 70% | ⚠️ Améliorable | [docs/notifications/01-notifications.md](notifications/01-notifications.md) |
| 💬 Système de Chat | — | 🗑️ Retiré (2026-06-22, `960852f`) + docs supprimées (#67) | Module supprimé du produit. |
| 📋 Audit Logging | 65% | ⚠️ Améliorable | [docs/audit-logging/01-journal-audit.md](audit-logging/01-journal-audit.md) |
| 📹 Suivi d'Examen | 40% | 🔧 Partiel | [docs/EXAM_MONITORING.md](EXAM_MONITORING.md) |

---

## 📖 Index des Guides de Référence

- **Authentification & Comptes** : [AUTH-COMPTES.md](AUTH-COMPTES.md)
- **Système Anti-Triche** : [ANTI_CHEAT_SYSTEM.md](ANTI_CHEAT_SYSTEM.md)
- **Monitoring d'Examens** : [EXAM_MONITORING.md](EXAM_MONITORING.md)
- **Routes de l'API** : [API_ROUTES_ANALYSIS.md](API_ROUTES_ANALYSIS.md) (analyse détaillée par criticité ; l'ancien inventaire `API-ROUTES.md` listait des routes supprimées — voir note d'entretien ci-dessous)
- **Sécurité et Corrections** : [SECURITY_FIX_GUIDE.md](SECURITY_FIX_GUIDE.md)
- **Plan d'Élimination des `any`** : [PLAN_CORRECTION_TYPES.md](PLAN_CORRECTION_TYPES.md)

*Note : Les anciens rapports d'audit ponctuels ont été archivés dans le sous-dossier `docs/archive_audits/`.*

---

## 🧹 Entretien documentation (2026-10-08)

État post-travaux sept–oct 2026 (voir `ROADMAP.md`, section « Vague infra ») :
**CI** (`.github/workflows/test.yml`), **staging** (`compose.staging.yml`, `deploy.yml`),
**images GHCR + rollback** (`ebeea12`), **purge RGPD** (`1bfab89`), **monitoring R2
ordonnancé** (`d498cfd`), **Sentry supprimé sur décision** (`1c63f0a` — uptime externe :
TODO humain), **SEO** (`999f5ac`), **refontes UX** catalogue/détail formations (`aa5c59a`),
auth (`b63daed`), pages publiques (`5bc2b8a`), documents (`8a2035a`).

Fichiers supprimés (contenu contredit par le code, 0 référence — `git rm`) :
- `docs/API-ROUTES.md` — inventaire citant 6 routes mortes (`/api/candidates/exams`,
  `/api/public/alumni`, `/api/settings`, `/api/submissions/submit`, `/api/auth/login`,
  `/api/auth/register`) ; remplacé par `API_ROUTES_ANALYSIS.md`.
- `docs/stage_request_flow.md` — décrivait un envoi CV en Base64 (`cvUrl` JSON, route
  « à créer si absent ») ; le flux réel utilise `lib/storage` (R2 + URL signée, Zod).
- `docs/technical_report.md` — rapport ponctuel d'avril 2026 (« ne pas modifier
  `lib/auth.ts` » alors que 8+ commits l'ont fait depuis : 2FA, `trustedOrigins`, OTP).
- `docs/public_tools.md`, `docs/tool_recommendations.md` — listes génériques d'outils
  (Clerk, Stripe, Auth0…) dont aucun n'est dans les dépendances (stack réelle : Better Auth).
- Tous les liens absolus `file:///c:/Users/PC/...` (illisibles hors poste d'origine)
  ont été convertis en liens relatifs.
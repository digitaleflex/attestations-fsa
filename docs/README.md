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
| 🔐 Authentification (Better Auth) | 100% | ✅ Complet | [docs/AUTH-COMPTES.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/AUTH-COMPTES.md) |
| 🛡️ Sécurité & Anti-Triche | 95% | ✅ Complet | [docs/ANTI_CHEAT_SYSTEM.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/ANTI_CHEAT_SYSTEM.md) |
| 📊 Dashboard Admin | 95% | ✅ Complet | [docs/admin-dashboard/01-tableau-bord.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/admin-dashboard/01-tableau-bord.md) |
| 🌐 Pages Publiques | 90% | ✅ Complet | [docs/public-pages/01-pages-publiques.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/public-pages/01-pages-publiques.md) |
| 📝 Gestion des Examens | 90% | ✅ Complet | [docs/exam-management/01-creation-examens.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/exam-management/01-creation-examens.md) |
| 📜 Gestion des Attestations | 85% | ✅ Complet | [docs/attestation-management/01-creation-attestations.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/attestation-management/01-creation-attestations.md) |
| ⏳ Waitlist d'inscription | — | 🗑️ Retiré (2026-06-22, `960852f`) | Module supprimé du produit : aucun modèle Prisma, aucune page, aucune API. |
| 🎓 Résultats & Transcripts | 80% | ✅ Complet | [docs/results-transcripts/01-consultation-resultats.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/results-transcripts/01-consultation-resultats.md) |
| ✏️ Demandes de Correction | 80% | ✅ Complet | Permet aux candidats de modifier leurs données personnelles d'identité sous validation admin. |
| 💼 Gestion des Stages | 75% | ⚠️ Améliorable | [docs/internship-management/01-demandes-stage.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/internship-management/01-demandes-stage.md) |
| 📚 Ressources pédagogiques | — | 🗑️ Retiré (2026-06-22, `960852f`) | Module supprimé du produit ; doc conservée à titre d'historique : [docs/resources-management/01-ressources.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/resources-management/01-ressources.md) |
| 🔔 Notifications (Pusher) | 70% | ⚠️ Améliorable | [docs/notifications/01-notifications.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/notifications/01-notifications.md) |
| 💬 Système de Chat | — | 🗑️ Retiré (2026-06-22, `960852f`) | Module supprimé du produit ; doc conservée à titre d'historique : [docs/chat-system/01-chat.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/chat-system/01-chat.md) |
| 📋 Audit Logging | 65% | ⚠️ Améliorable | [docs/audit-logging/01-journal-audit.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/audit-logging/01-journal-audit.md) |
| 📹 Suivi d'Examen | 40% | 🔧 Partiel | [docs/EXAM_MONITORING.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/EXAM_MONITORING.md) |

---

## 📖 Index des Guides de Référence

- **Authentification & Comptes** : [AUTH-COMPTES.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/AUTH-COMPTES.md)
- **Système Anti-Triche** : [ANTI_CHEAT_SYSTEM.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/ANTI_CHEAT_SYSTEM.md)
- **Monitoring d'Examens** : [EXAM_MONITORING.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/EXAM_MONITORING.md)
- **Routes de l'API** : [API-ROUTES.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/API-ROUTES.md)
- **Sécurité et Corrections** : [SECURITY_FIX_GUIDE.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/SECURITY_FIX_GUIDE.md)
- **Plan d'Élimination des `any`** : [PLAN_CORRECTION_TYPES.md](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/docs/PLAN_CORRECTION_TYPES.md)

*Note : Les anciens rapports d'audit ponctuels ont été archivés dans le sous-dossier `docs/archive_audits/`.*
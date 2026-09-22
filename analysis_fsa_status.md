# Analyse de Maturité - Plateforme FSA

> **Mise à jour du 2026-09-22** : cette analyse d'avril 2026 a été corrigée après
> **vérification par recherche de code**. Trois fonctionnalités annoncées comme
> « manquantes » **existent** : le tunnel de correction, le signalement et les logs
> d'audit. Les preuves (fichiers) sont données dans les sections concernées.

Cette analyse détaille l'état de complétion des fonctionnalités clés du portail FSA, en identifiant les zones d'ombre et les chantiers restants pour une exploitation optimale en production.

## 🟢 Fonctionnalités Finalisées (Production-Ready)
*   **Gestion des Examens** : Création, modification, et planification des examens (QCM) avec calcul de score automatique pour la Partie 1.
*   **Flux de Certification** : Génération automatique de codes QR uniques et d'attestations PDF pour les examens officiels réussis.
*   **Portail Candidat** : Inscription, connexion, interface de passage d'examen et consultation des résultats (Relevé de notes).
*   **Système de Notifications** : Alertes emails et notifications en temps réel (Pusher) pour les résultats et validations.
*   **Vérification Publique** : Outil de vérification d'attestation via code ou scan QR (`app/(public)/verifier/page.tsx`, `verifier-qr`, `verification-success/error`).

## 🟡 Fonctionnalités Partiellement Implémentées
### 1. Correction Manuelle (Parties 2 & 3)
*   **État** : La logique de séparation (En attente de correction) est là (Examens Blancs & Officiels), mais l'interface admin de correction pourrait être optimisée.
*   **Partiel (corrigé 2026-09-22)** : L'upload et la visualisation des **compositions scannées** (modèle `CompositionScan`) sont amorcés — routes `app/api/admin/submissions/[id]/scans/route.ts` et `app/api/admin/submissions/[id]/scans/[scanId]/route.ts`, UI dans `app/admin/submissions/[id]/page.tsx` — mais l'expérience reste à compléter.

### 🛠️ État d'avancement du Refactoring (Typage Strict)

> ⚠️ Tableau hérité d'avril 2026, **non re-mesuré** le 2026-09-22. La ligne
> `app/api/chat/route.ts` a été retirée : le module Chat a été supprimé le
> 2026-06-22 (commit `960852f`).

| Module | Fichier(s) | Statut | 'any' supprimés |
| :--- | :--- | :--- | :--- |
| **Global Types** | `types/index.ts` | ✅ Terminé | Centralisation |
| **Session Examen** | `app/(user)/exams/[id]/page.tsx` | ✅ Terminé | 11 |
| **Monitoring** | `app/admin/monitoring/page.tsx` | ✅ Terminé | 8 |
| **Admin Dashboard** | `app/admin/dashboard/page.tsx` | ✅ Terminé | ~15 |
| **User Dashboard** | `app/(user)/dashboard/page.tsx` | ✅ Terminé | 8 |
| **Submissions** | `app/admin/submissions/page.tsx` | ✅ Terminé | 7 |
| **Grading** | `app/admin/submissions/[id]/page.tsx` | ✅ Terminé | 6 |
| **Audit Logs** | `app/admin/logs/page.tsx` | ✅ Terminé | 6 |
| **User Stats API** | `app/api/user/statistics/route.ts` | ✅ Terminé | 6 |
| **Édition Attestation**| `app/admin/attestations/[id]/edit/page.tsx` | 🟧 En cours | 12 |
| **Profil Utilisateur** | `app/(user)/profile/page.tsx` | ❌ À faire | - |

**Score Actuel :** ~80 instances supprimées sur les modules critiques.
**Estimation Restante :** ~280 instances (dont beaucoup dans les types auto-générés ou les librairies tierces sans types).

### 2. Bibliothèque de Ressources → 🗑️ MODULE RETIRÉ
*   **État (corrigé 2026-09-22)** : Le module Ressources (modèle `Resource`, pages publique/admin, API) a été **supprimé le 2026-06-22** (commit `960852f`). Cette section est obsolète.

### 3. Demandes de Stage et Stages
*   **État** : Formulaire de demande et gestion admin basique.
*   **Manquant** : Workflow de suivi du stagiaire (évaluation de fin de stage, génération automatique d'attestation de stage distincte de celle de formation).

## 🔴 Fonctionnalités Manquantes ou à Développer

> ⚠️ **Correction 2026-09-22** : les points 1, 2 et 3 ci-dessous, annoncés comme
> manquants en avril 2026, **existent désormais**. Ils sont conservés avec leur
> preuve de code ; le reste du chantier suit.

### 1. Tunnel de correction — ✅ EXISTE
*   **Preuve** : `app/api/user/attestations/[id]/correction/route.ts` (+ UI `components/CorrectionModal.tsx`, branchée dans `app/(user)/attestations/[id]/page.tsx` et `app/(user)/dashboard/page.tsx`), couvert par `tests/api/user-attestation-correction.test.ts`.

### 2. Signalement — ✅ EXISTE
*   **Preuve** : `app/api/signalement/route.ts` (+ `app/api/signalement/[id]/route.ts`), page `app/(public)/signalement/page.tsx`, couvert par `tests/api/signalement.test.ts`.

### 3. Monitoring et Audit — ✅ EXISTE
*   **Preuve** : `app/api/admin/audit/route.ts`, `app/api/admin/logs`, `app/api/users/[id]/audit-logs/route.ts`, tableau de bord admin `app/admin/logs/page.tsx` ; couvert par `tests/api/admin-audit.test.ts` et `tests/api/admin-logs.test.ts`.

### 4. Personnalisation Institutionnelle — reste à faire
*   **Probématique** : Bien que `Settings` existe, la personnalisation des signatures et des logos pour chaque type de formation/attestation est limitée à une structure globale.
*   **Besoin** : Pouvoir définir des signataires différents selon les catégories de formation.

### 5. Waitlist et Marketing → 🗑️ MODULE RETIRÉ
*   **État (corrigé 2026-09-22)** : Le module Waitlist a été **supprimé le 2026-06-22** (commit `960852f`). Section obsolète.

## 🚀 Prochaines Étapes Recommandées
1.  **Priorité 1** : Finaliser l'interface d'upload et de visualisation des scans pour les examens physiques (Correction Partie 3) — routes et UI amorcées, expérience à compléter.
2.  **Priorité 2** : Étendre la personnalisation institutionnelle (signataires par catégorie de formation).
3.  **Priorité 3** : Relever la couverture de tests (61,72 % lignes au 2026-09-22, ratchet `59/53/63/60`) et faire tourner le job `e2e` de la CI sur un runner GitHub.

---
> [!NOTE]
> L'architecture est très solide, le socle technique supporte déjà les besoins complexes (Temps réel, PDF dynamique, Audit). L'effort doit maintenant se porter sur l'expérience "Support" (corrections, logs, gestion des erreurs).

# 📋 BACKLOG DE DÉVELOPPEMENT : ATTESTATION TRACKER FSA (V16)

Document de suivi des tâches, priorisé pour les standards Next.js 16.
**Dernière vérification : 2026-09-22** — chaque état « ✅ Terminé » ci-dessous est adossé à une preuve de code (fichier vérifié) ; les états « ❓ Non revérifié » n'ont pas pu être confirmés.

---

## 🏃 SPRINT 1 : STABILITÉ & INFRASTRUCTURE (Priorité Critique)
**Objectif** : Éliminer les erreurs bloquantes, réparer l'environnement et s'aligner sur les standards v16.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **INF-01** | **Migration Proxy** | Renommer `middleware.ts` en `proxy.ts`, adapter l'export `proxy` et configurer le matcher v16. | ✅ Terminé — `proxy.ts` présent, `middleware.ts` absent |
| **INF-02** | **Sanitization node_modules** | Supprimer `node_modules`, `pnpm-lock.yaml`, et réinstaller via `pnpm install` pour corriger les types. | ❓ Non vérifiable depuis le dépôt (tâche d'environnement local) |
| **BUG-01** | **Correction SSR LocalStorage** | Sécuriser `lib/useExamMonitoring.ts` et les pages d'attestation avec `typeof window` guards. | ✅ Terminé — gardes `typeof window` dans `app/(user)/attestations/page.tsx` et `app/admin/attestations/new/page.tsx` ; `lib/useExamMonitoring.ts` n'accède à `window` que dans des `useEffect` (client-only) |
| **SEC-01** | **Validation Auth API** | Configurer explicitement `baseURL` et `secret` dans `lib/auth.ts` pour Better Auth. | ✅ Terminé — `secret` et `baseURL` explicites dans `lib/auth.ts` |

---

## 🎓 SPRINT 2 : EXPÉRIENCE CANDIDAT (FEATURES)
**Objectif** : Fluidité du passage des examens et anti-triche.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **EXM-01** | **Auto-save des réponses** | Sauvegarde périodique (30s) des réponses d'examen vers Redis pour prévenir toute perte. | ❓ Non revérifié |
| **EXM-02** | **Monitoring Tab-Switch** | Détection et logging des sorties du navigateur pendant un examen (Monitoring Layer). | ✅ Terminé — `lib/useExamMonitoring.ts` (listeners `blur` / `copy` / `paste` / `contextmenu`) |
| **RES-01** | **Page Résultats Dynamique** | Vue récapitulative post-examen avec calcul du succès, graphiques et mention auto. | ✅ Terminé — `app/(user)/results/[id]/page.tsx` |

---

## 🔐 SPRINT 3 : ADMINISTRATION & CERTIFICATION (PREMIUM)
**Objectif** : Gestion industrielle des attestations.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **ADM-01** | **Assistant Création Manuelle** | Workflow admin pour générer des attestations hors-examen avec validation Zod poussée. | ✅ Terminé — `app/admin/attestations/new/page.tsx` |
| **ADM-02** | **Générateur PDF** | Template PDF avec signatures et QR Code de sécurité. | ✅ Terminé — PDF via `jspdf` / `html2pdf.js` (`components/OfficialDocument.tsx`) |
| **VER-01** | **Portail Vérification Public** | Interface permettant aux employeurs de scanner une attestation pour attester de sa validité. | ✅ Terminé — `app/(public)/verifier/page.tsx` (+ `verifier-qr`, `verification-success/error`) |

---

## 💎 SPRINT 4 : OPTIMISATION & UI/UX (POLISSAGE)
**Objectif** : Performance et esthétique de pointe.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **PER-01** | **Partial Prerendering (PPR)** | Activer le PPR sur la page d'accueil pour un chargement instantané des sections statiques. | 📅 Backlog (non revérifié) |
| **UI-01** | **Dark Mode Sophistiqué** | Thème sombre haut de gamme avec Glassmorphism et variables CSS harmonisées. | 📅 Backlog (non revérifié) |
| **UI-02** | **Animations Framer Motion** | Micro-interactions sur les boutons, tableaux et modales pour une expérience premium. | 📅 Backlog (non revérifié) |

---

> [!IMPORTANT]
> **État au 2026-09-22** : **INF-01, BUG-01 et SEC-01 sont terminés** (preuves de code ci-dessus). Le focus restant est **INF-02** (à vérifier localement, non contrôlable depuis le dépôt).

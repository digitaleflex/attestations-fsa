# 📋 BACKLOG DE DÉVELOPPEMENT : ATTESTATION TRACKER FSA (V16)

Document de suivi des tâches, priorisé pour les standards Next.js 16 (Avril 2026).

---

## 🏃 SPRINT 1 : STABILITÉ & INFRASTRUCTURE (Priorité Critique)
**Objectif** : Éliminer les erreurs bloquantes, réparer l'environnement et s'aligner sur les standards v16.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **INF-01** | **Migration Proxy** | Renommer `middleware.ts` en `proxy.ts`, adapter l'export `proxy` et configurer le matcher v16. | 🔄 En cours |
| **INF-02** | **Sanitization node_modules** | Supprimer `node_modules`, `pnpm-lock.yaml`, et réinstaller via `pnpm install` pour corriger les types. | 🚀 À faire |
| **BUG-01** | **Correction SSR LocalStorage** | Sécuriser `lib/useExamMonitoring.ts` et les pages d'attestation avec `typeof window` guards. | 🚀 À faire |
| **SEC-01** | **Validation Auth API** | Configurer explicitement `baseURL` et `secret` dans `lib/auth.ts` pour Better Auth. | 🚀 À faire |

---

## 🎓 SPRINT 2 : EXPÉRIENCE CANDIDAT (FEATURES)
**Objectif** : Fluidité du passage des examens et anti-triche.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **EXM-01** | **Auto-save des réponses** | Sauvegarde périodique (30s) des réponses d'examen vers Redis pour prévenir toute perte. | 📅 Backlog |
| **EXM-02** | **Monitoring Tab-Switch** | Détection et logging des sorties du navigateur pendant un examen (Monitoring Layer). | 📅 Backlog |
| **RES-01** | **Page Résultats Dynamique** | Vue récapitulative post-examen avec calcul du succès, graphiques et mention auto. | 📅 Backlog |

---

## 🔐 SPRINT 3 : ADMINISTRATION & CERTIFICATION (PREMIUM)
**Objectif** : Gestion industrielle des attestations.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **ADM-01** | **Assistant Création Manuelle** | Workflow admin pour générer des attestations hors-examen avec validation Zod poussée. | 📅 Backlog |
| **ADM-02** | **Générateur PDF Vectoriel** | Template PDF haute définition avec signatures numériques et QR Code de sécurité. | 📅 Backlog |
| **VER-01** | **Portail Vérification Public** | Interface permettant aux employeurs de scanner une attestation pour attester de sa validité. | 📅 Backlog |

---

## 💎 SPRINT 4 : OPTIMISATION & UI/UX (POLISSAGE)
**Objectif** : Performance et esthétique de pointe.

| ID | Titre | Description | État |
| :--- | :--- | :--- | :--- |
| **PER-01** | **Partial Prerendering (PPR)** | Activer le PPR sur la page d'accueil pour un chargement instantané des sections statiques. | 📅 Backlog |
| **UI-01** | **Dark Mode Sophistiqué** | Thème sombre haut de gamme avec Glassmorphism et variables CSS harmonisées. | 📅 Backlog |
| **UI-02** | **Animations Framer Motion** | Micro-interactions sur les boutons, tableaux et modales pour une expérience premium. | 📅 Backlog |

---

> [!IMPORTANT]
> **Focus de la semaine** : Terminer les tâches **INF-01**, **INF-02** et **BUG-01** pour retrouver un environnement de développement sain et fluide.

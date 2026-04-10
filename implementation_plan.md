# [PROJET] Projets Pratiques Avancés & Mentorat FSA

Ce projet implémente un système de progression basé sur la performance aux examens. Les candidats débloquent des projets pratiques réels avec un accompagnement spécifique selon leur note (Standard vs Expert).

## User Review Required

> [!IMPORTANT]
> **Répartition des Niveaux de Déblocage** : 
> - **Note < 13/20** : Projet Verrouillé.
> - **Note 13-15/20** : Projet Débloqué (Niveau Standard) - Accompagnement groupé.
> - **Note >= 16/20** : Projet Débloqué (Niveau Avancé) - Mentorat personnalisé stratégique.

## Proposed Changes

### 📁 Base de Données (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/prisma/schema.prisma)
- Ajout de l'enum `ProjectLevel` (`STANDARD`, `ADVANCED`).
- Modification de `UserPortfolioMission` :
    - `unlockedLevel` : `ProjectLevel?` - Définit le niveau d'accès de l'élève.
    - `files` : `Json?` - Pour stocker un tableau d'URLs de preuves (PDF, Images).
- Modification de `ChatMessage` :
    - `portfolioMissionId` : `String?` - Pour lier une discussion à un projet spécifique.

---

### 🌐 API (Backend)

#### [MODIFY] [api/user/portfolio/status/route.ts](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/app/api/user/portfolio/status/route.ts)
- Ajout de la logique de calcul automatique du niveau :
    - Récupération de la note de l'examen lié (`totalScore` / `totalPoints` * 20).
    - Attribution du `unlockedLevel` selon les seuils (13 et 16).

---

### 🎨 Interface Utilisateur (UX/UI)

#### [NEW] [ProjectWorkspace.tsx](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/components/portfolio/ProjectWorkspace.tsx)
- Un espace immersif de gestion de projet : 
    - **Zone Guide** : Guide Markdown détaillé.
    - **Zone Soumission Multi-Fichiers** : Upload et prévisualisation des preuves (PDF/Images).
    - **Chat Mentor** : Chat en temps réel dédié au projet (filtré par `portfolioMissionId`).

#### [MODIFY] [app/(user)/dashboard/page.tsx](file:///c:/Users/PC/Documents/GitHub/attestations-fsa/app/(user)/dashboard/page.tsx)
- Affichage du niveau de mentorat débloqué sur le widget "Parcours Professionnel".

---

## Open Questions

> [!NOTE]
> 1. **Stockage des fichiers** : Les fichiers seront-ils stockés sur Vercel Blob ou un service externe type Google Drive ? (Je recommande d'utiliser les liens externes pour la flexibilité).
> 2. **Canal Commun** : Pour le niveau Standard (13-15/20), le "canal commun" sera-t-il une page de groupe ou un chat global ? (Je propose un thread de discussion lié à la mission mais partagé entre tous ceux du même niveau).

## Verification Plan

### Automated Tests
- Script de test pour valider que le niveau `ADVANCED` n'est attribué qu'à partir de 16/20.

### Manual Verification
- Test de l'upload multi-fichiers.
- Vérification que les messages envoyés dans un projet n'apparaissent pas dans un autre.

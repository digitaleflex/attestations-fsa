# Gestion des Stages

## Description

Module de gestion des demandes de stage,suivi et génération d'attestations de stage.

## Fonctionnalités implémentées

### 1. Demandes de stage (Étudiant)

- Soumission de demande de stage
- Entreprise, dates, mission, superviseur
- Statut de la demande (PENDING, APPROVED, REJECTED)

### 2. Validation (Admin)

- Liste des demandes en attente
- Approbation ou rejet
- Commentaires de validation

### 3. Attestation de stage

- Générée automatiquement après approbation
- Heures de stage effectuées
- Score et observations du superviseur
- Signature de l'entreprise

## Niveau d'avancement

**75%** - En production

## Fichiers clés

- `app/api/user/internships/route.ts` - API étudiant
- `app/api/admin/internships/route.ts` - API admin
- `app/api/admin/internships/[id]/attestation/route.ts` - Génération attestation
- `app/(user)/internships/page.tsx` - Page étudiant

## API Endpoints

- `POST /api/user/internships` - Soumet une demande
- `GET /api/user/internships` - Liste mes stages
- `GET /api/admin/internships` - Liste toutes les demandes
- `PATCH /api/admin/internships/[id]` - Valide/rejette

## Suggestions d'amélioration

1. Ajouter un système de convention de stage PDF
2. Implémenter un suivi de présence/heures
3. Ajouter une notation par le superviseur
4. Mettre en place des notifications de rappel de fin de stage

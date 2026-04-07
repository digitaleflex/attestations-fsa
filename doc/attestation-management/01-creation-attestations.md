# Attestation Management

## Description

Module de création et gestion des attestations de formation, stage et certification avec génération automatique de codes uniques.

## Fonctionnalités implémentées

### 1. Création d'attestation

- Types supportés :
  - FORMATION : Attestation de formation
  - STAGE : Attestation de stage avec heures et appréciation
  - CERTIFICATION : Certification avec mention et score
- Génération automatique de code formaté : `FSA-YYYY-MM-NNNNN-HASH`
- Champs obligatoires : nom complet, date/ lieu de naissance, formation, dates, lieu, formateur, société émettrice

### 2. Types de mentions (Certification)

- PASSABLE
- ASSEZ_BIEN
- BIEN
- TRES_BIEN
- EXCELLENCE

### 3. Statuts d'attestation

- PENDING : En attente de validation
- VALIDATED : Validée et émise
- REJECTED : Rejetée

### 4. Recherche et filtrage

- Recherche par nom, code, type
- Filtrage par statut
- Pagination
- Tri par date d'émission

### 5. Opérations en masse

- Export Excel des attestations
- Actions groupées (validation, suppression)

## Niveau d'avancement

**85%** - Production

## Fichiers clés

- `app/api/attestations/route.ts` - API principale
- `app/api/admin/attestations/` - API admin
- `components/CertificateTemplate.tsx` - Template PDF
- `components/OfficialDocument.tsx` - Document officiel

## API Endpoints

- `GET /api/attestations` - Liste admin (authentifié)
- `POST /api/attestations` - Création (admin)
- `GET /api/attestations/[id]` - Détail
- `PATCH /api/attestations/[id]` - Modification
- `GET /api/verifier` - Vérification publique

## Suggestions d'amélioration

1. Ajouter un système de signature numérique
2. Implémenter la génération QR code intégré au PDF
3. Ajouter un historique des modifications
4. Mettre en place un workflow d'approbation multi-niveaux
5. Ajouter la génération de diplômes officiels

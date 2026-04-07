# Support et Contact

## Description

Module de gestion des demandes de support et des contacts pour le support utilisateur.

## Fonctionnalités implémentées

### 1. Formulaire de contact

- Nom, email, sujet, message
- Upload de fichiers (optionnel)
- Catégorisation du sujet

### 2. Gestion admin

- Liste des messages reçus
- Détail de chaque message
- Marquer comme lu/répondu
- Réponse directe depuis l'interface
- Statut du ticket

### 3. Support étudiant

- Page de demande d'aide
- Suivi des demandes
- Historique des échanges

## Niveau d'avancement

**80%** - Production

## Fichiers clés

- `app/api/public/contact/route.ts` - API contact public
- `app/api/admin/contacts/route.ts` - API admin
- `app/(public)/contact/page.tsx` - Page contact
- `app/(user)/support/page.tsx` - Page support utilisateur
- `app/admin/messages/page.tsx` - Centre de gestion

## Suggestions d'amélioration

1. Intégrer un système de tickets (Zendesk/Intercom)
2. Ajouter un chat en direct
3. Créer une base de connaissances
4. Implémenter un système de Priorité (urgent/normal/bas)

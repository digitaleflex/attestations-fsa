# Journal d'Audit (Audit Logging)

## Description

Système de traçabilité de toutes les actions effectuées dans l'application pour des raisons de conformité et de sécurité.

## Fonctionnalités implémentées

### 1. Journalisation des actions

- Création, modification, suppression de ressources
- Actions utilisateur (connexion, déconnexion, modification profil)
- Actions admin (validation, rejet, modification)

### 2. Informations enregistrées

- ID utilisateur
- Action effectuée
- Ressource touchée
- ID de la ressource
- Valeurs anciennes et nouvelles
- Adresse IP
- Horodatage

### 3. Consultation admin

- Filtre par utilisateur, action, ressource
- Recherche textuelle
- Export des logs

### 4. Historique des modifications

- Pour chaque attestation : historique complet
- Détail des changements entre versions

## Niveau d'avancement

**65%** - Partiellement implémenté

## Fichiers clés

- `lib/audit.ts` - Logique de création des logs
- `app/api/admin/audit/route.ts` - API consultation
- `app/api/admin/attestations/[id]/audit/route.ts` - Historique attestation

## Limitations actuelles

- Pas de log automatique sur toutes les routes API
- Pas de rétention configurable
- Pas de rotation des logs

## Suggestions d'amélioration

1. Middleware automatique pour logger toutes les requêtes API
2. Implémenter une rétention configurable (GDPR)
3. Ajouter des alertes sur actions sensibles
4. Intégrer avec un système SIEM
5. Créer des rapports d'activité automatisés

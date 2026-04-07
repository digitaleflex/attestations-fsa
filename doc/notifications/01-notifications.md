# Système de Notifications

## Description

Module de notifications temps réel pour informer les utilisateurs des événements importants.

## Fonctionnalités implémentées

### 1. Notifications push

- Notification lors de la publication d'un résultat
- Notification lors de la disponibilité d'une attestation
- Notification lors d'un nouvel examen
- Notification lors d'un nouveau message admin

### 2. Centre de notifications (Admin)

- Liste de toutes les notifications envoyées
- Notifications groupées/individuelles
- Statut (envoyée, échouée)

### 3. Notifications utilisateur

- Badge sur la cloche de notification
- Liste des notifications personnelles
- Marquer comme lu

### 4. Envoi en masse

- Envoi de notification à tous les utilisateurs
- Envoi par formation/role

## Niveau d'avancement

**70%** - En production avec améliorations en cours

## Fichiers clés

- `components/NotificationBell.tsx` - Composant cloche
- `components/admin/NotificationCenter.tsx` - Centre admin
- `app/api/admin/notifications/bulk/route.ts` - Envoi en masse
- `app/api/user/notifications/route.ts` - API utilisateur
- `lib/notifications.ts` - Logique d'envoi
- `lib/pusher.ts` - Service temps réel

## Suggestions d'amélioration

1. Ajouter des notifications par email
2. Implémenter les notifications push navigateur (Service Worker)
3. Ajouter des notifications par SMS
4. Créer des modèles de notification réutilisables

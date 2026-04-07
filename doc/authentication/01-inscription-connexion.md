# Authentification

## Description

Système d'authentification unifié utilisant Better Auth avec support hybride pour la compatibilité legacy.

## Fonctionnalités implémentées

### 1. Inscription / Connexion

- Inscription par email/mot de passe
- Connexion avec gestion de session
- Mot de passe minimum 8 caractères

### 2. Vérification par OTP (Email)

- Envoi de code OTP par email pour vérification
- Code à 6 chiffres, expire en 10 minutes
- 5 tentatives maximum avant rotation

### 3. Rôles et Permissions

- Rôle ADMIN pour les administrateurs
- Rôle USER pour les utilisateurs standard
- Système de protection des routes (`AdminRoute.tsx`)

### 4. Gestion de session

- Session expire après 30 jours
- Mise à jour automatique après 1 jour

### 5. Origins信任s (Trusted Origins)

- `https://fsa.eurinhash.com`
- `https://verifier.fermestandre.com`
- `https://attestations-fsa.vercel.app`
- `https://*.vercel.app`

## Niveau d'avancement

**100%** - Production

## Fichiers clés

- `lib/auth.ts` - Configuration principale
- `app/api/auth/[...all]/route.ts` - Routes API Better Auth
- `components/auth/AdminRoute.tsx` - Protection des routes admin
- `app/admin/login/page.tsx` - Page de connexion

## Suggestions d'amélioration

1. Ajouter la vérification en deux étapes (2FA) pour les admins
2. Implémenter la déconnexion sociale (OAuth: Google, GitHub)
3. Ajouter un système de session concurrente (limiter le nombre de sessions actives)

# Pages Publiques

> ⚠️ **Réaligné le 2026-09-16 (issue #86)** : les pages `/ressources`, `/portfolios`,
> `/annuaire` et `/signup` (waitlist) annoncées ici **n'existent pas / n'ont jamais
> été recréées**. Les modules correspondants ont été retirés du produit le 2026-06-22
> (commit `960852f`). L'inscription publique réelle se fait sur `/inscription`.

## Description

Ensemble des pages accessibles sans authentification pour le grand public.

## Fonctionnalités implémentées

### 1. Page d'accueil (`/`)

- Présentation de la plateforme
- Fonctionnalités principales
- Témoignages/FAQ
- Appels à l'action

### 2. Vérification d'attestation (`/verifier`)

- Formulaire de recherche par code -结果 affiché avec détail de l'attestation
- Protection par rate limiting

### 3. Formations (`/formations`)

- Liste des formations disponibles
- Détails par formation
- Lien vers inscription

### 4. FAQ (`/faq`)

- Questions fréquentes
- Réponses structurées

### 5. Contact (`/contact`)

- Formulaire de contact
- Envoi aux administrateurs
- Gestion côté admin

### 6. Inscription (`/inscription`)

- Création de compte public (email + mot de passe, Better Auth)
- Vérification d'email par OTP après inscription

### 7. Mentions légales

- CGU (`/legal/cgu`)
- Confidentialité (`/legal/confidentialite`)
- Cookies (`/legal/cookies`)
- Mentions légales (`/legal/mentions-legales`)

### 8. Autres pages publiques

- Examens (`/examens`)
- Demande de stage (`/demande-stage`)
- Signalement (`/signalement`)
- Authentification (`/auth`), mot de passe oublié / réinitialisation

## Niveau d'avancement

**90%** - Production

## Pages clés

- `app/(public)/page.tsx` - Page d'accueil
- `app/(public)/verifier/page.tsx` - Vérification
- `app/(public)/formations/page.tsx` - Formations

## Suggestions d'amélioration

1. Ajouter un blog/actualités
2. Implémenter une section carrières
3. Ajouter un système de chat avec IA pour les questions fréquentes

# Sécurité

## Description

Ensemble des mesures de sécurité implémentées dans l'application.

## Fonctionnalités implémentées

### 1. Rate Limiting

- Protection des endpoints critiques
- Limite de 10 vérifications/heure pour `/api/verifier`
- Limite configurable par endpoint
- Utilisation d'Upstash Redis

### 2. Sanitization des entrées

- Nettoyage des entrées utilisateur
- Prévention XSS et SQL injection
- Validation Zod stricte

### 3. Gestion des erreurs

- Translation des erreurs en messages français
- Logging des erreurs
- Masquage des détails techniques en production

### 4. Headers de sécurité

- CSRF protection
- Headers HTTP sécurisés (via Next.js)

### 5. Chiffrement

- Stockage sécurisé des mots de passe (bcrypt)
- Sessions sécurisées avec cookies httpOnly

### 6. Trusted Origins (#283)

- Liste blanche des domaines autorisés
- Prévention des attaques CORS
- **En production, allowlist EXACTE uniquement** : les jokers
  (`https://*.vercel.app`, `http://192.168.0.*`, …) sont REJETÉS, car ils
  autorisent n'importe quel sous-domaine d'un hébergeur tiers à piloter des
  requêtes cross-site authentifiées (CSRF / vol de session). Les jokers ne
  subsistent qu'hors production (`NODE_ENV !== "production"`).
- Toute origine configurée qui n'est pas une URL absolue `http(s)` est
  ignorée (et signalée dans les logs au démarrage).

#### Configuration

| Variable | Rôle | Exemple |
| --- | --- | --- |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` | origine(s) de l'application | `https://fsa.eurin.tech` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | origines supplémentaires, séparées par des virgules | `https://verifier.fsa.eurin.tech` |
| `AUTH_TRUSTED_ORIGINS` | alias de la précédente | idem |
| `BETTER_AUTH_TRUST_ORIGINS_ALLOW_WILDCARDS` | échappatoire explicite (`"true"`) pour un déploiement multi-tenant à jokers | non défini (refus par défaut) |

Implémentation : `resolveTrustedOrigins()` / `parseTrustedOrigin()` dans
`lib/auth.ts` (tests : `tests/security/trusted-origins.test.ts`).

### 7. Statut de compte (#304)

- `UserStatus` (`ACTIVE` / `BLOCKED` / `SUSPENDED`) est désormais **appliqué**,
  et non plus seulement écrit :
  - **connexion** : `databaseHooks.session.create.before` (mot de passe, OTP,
    2FA, providers) → aucune session créée pour un compte bloqué ;
  - **refresh / lecture de session** : hook `hooks.before` sur `/get-session` ;
  - **routes utilisateur et admin** : `getCurrentUser()` / `getAdminUser()`
    dans `lib/auth.ts` (donc aussi `requireUser` / `requireAdmin` de
    `@/lib/api-auth`) renvoient `null` → 401 ;
  - **connexion FSA/OTP** : contrôle anticipé dans
    `app/api/auth/fsa-login/route.ts` → 403.
- Les sessions vivantes d'un compte bloqué/suspendu sont **révoquées** au
  changement de statut (`PATCH /api/users/[id]`) et à chaque appel
  d'enforcement.
- Une suspension datée (`suspendedUntil` → `banExpires`) **expire** : le compte
  est automatiquement réactivé et purgé en base.
- Source unique de vérité : `lib/account-status.ts`
  (`isAccountAllowed`, `enforceAccountStatus`, `revokeUserSessions`).

## Niveau d'avancement

**80%** - En production

## Fichiers clés

- `lib/rate-limit.ts` - Rate limiting
- `lib/sanitization.ts` - Nettoyage entrées
- `lib/error-translator.ts` - Translation erreurs
- `lib/error-handler.ts` - Gestion erreurs

## Suggestions d'amélioration

1. Implémenter une protection DDoS (Cloudflare)
2. Ajouter des audits de sécurité automatisés
3. Implémenter le chiffrement des données au repos
4. Ajouter une authentification forte (MFA) pour les admins
5. Mettre en place un WAF (Web Application Firewall)

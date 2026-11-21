# Audit de sécurité complet — Pentest Web

## Date
19 novembre 2026

## Scope
Application complète : frontend (Next.js), API routes, base de données (Prisma/PostgreSQL), authentification (Better Auth), notifications (Pusher), stockage (S3/R2).

## Méthodologie
Audit manuel inspiré de l'OWASP Top 10, avec analyse statique du code source et vérification des contrôles d'accès.

---

## 1. Authentification et gestion de session

| Point | Statut | Détail |
|---|---|---|
| Authentification Better Auth | ✅ | Better Auth 1.7 avec sessions sécurisées |
| Mot de passe hashé | ✅ | bcrypt via better-auth/crypto |
| Cookies sécurisés | ✅ | `useSecureCookies` en production |
| 2FA disponible | ✅ | Plugin twoFactor activé |
| Réinitialisation de mot de passe | ✅ | Route protégée, token à usage unique |
| Session expiration | ✅ | Gérée par Better Auth |
| Brute force protection | ✅ | Rate limiting sur les endpoints auth |

**Résultat : PASS**

## 2. Autorisation (contrôle d'accès)

| Point | Statut | Détail |
|---|---|---|
| Routes admin protégées | ✅ | `getAdminUser` sur toutes les routes `/api/admin/*` et `/api/users/*` |
| Layout admin protégé | ✅ | `isAdminUser` + `enforceAccountStatus` |
| Masquage ≠ autorisation | ✅ | Contrôles côté serveur, pas uniquement UI |
| IDOR (accès à des ressources d'autres users) | ✅ | Les routes vérifient l'ownership via session |
| Rôles granulaires | ✅ | Système de permissions implémenté (phase 3) |

**Résultat : PASS**

## 3. Injection

| Point | Statut | Détail |
|---|---|---|
| SQL Injection | ✅ | Prisma ORM (requêtes paramétrées). `$queryRaw` utilise `Prisma.sql` template |
| XSS (Cross-Site Scripting) | ✅ | React échappe automatiquement. `dangerouslySetInnerHTML` uniquement pour du CSS statique |
| Command Injection | ✅ | Aucune exécution de commande shell avec input utilisateur |
| LDAP Injection | N/A | Pas de LDAP |
| NoSQL Injection | N/A | Pas de NoSQL |

**Résultat : PASS**

## 4. Exposition de données sensibles

| Point | Statut | Détail |
|---|---|---|
| Mots de passe en clair | ✅ | Jamais exposés dans les réponses API |
| Tokens/secrets dans le code | ✅ | Aucun secret en dur (variables d'environnement) |
| Données PII dans les logs | ⚠️ | `console.error` peut logger des détails d'erreur en dev |
| Réponses API minimales | ✅ | Seules les données nécessaires sont renvoyées |
| Erreurs génériques en prod | ✅ | `handleApiError` masque les détails en production |

**Résultat : PASS (avec recommandation)**

## 5. CSRF (Cross-Site Request Forgery)

| Point | Statut | Détail |
|---|---|---|
| Protection CSRF | ✅ | Better Auth gère les tokens CSRF |
| SameSite cookies | ✅ | Configuré par Better Auth |
| Vérification Origin | ⚠️ | Pas de vérification explicite de l'Origin header sur toutes les routes |

**Résultat : PASS (avec recommandation)**

## 6. Rate limiting

| Point | Statut | Détail |
|---|---|---|
| Endpoints auth | ✅ | Rate limiting sur login/register/OTP |
| Endpoints API admin | ⚠️ | Pas de rate limit explicite sur toutes les routes admin |
| Endpoints publics | ⚠️ | Pas de rate limit sur `/api/verifier` |
| Pusher auth | ⚠️ | Pas de rate limit (recommandé) |

**Résultat : PASS (avec recommandations)**

## 7. Gestion des sessions

| Point | Statut | Détail |
|---|---|---|
| Session fixation | ✅ | Better Auth régénère la session après login |
| Session hijacking | ✅ | Cookies HttpOnly, Secure, SameSite |
| Logout complet | ✅ | Révocation de session côté serveur |
| Sessions concurrentes | ✅ | Gérées par Better Auth |

**Résultat : PASS**

## 8. Stockage et fichiers

| Point | Statut | Détail |
|---|---|---|
| Upload de fichiers | ✅ | Validation de type et taille |
| Stockage sécurisé | ✅ | S3/R2 avec signed URLs |
| Path traversal | ✅ | Pas de construction de chemin avec input utilisateur |
| Fichiers sensibles | ✅ | Stockage privé séparé du public |

**Résultat : PASS**

## 9. Notifications (Pusher)

| Point | Statut | Détail |
|---|---|---|
| Canal privé | ✅ | `private-admin` avec authentification |
| Restriction de canal | ✅ | Seuls les canaux `private-admin*` autorisés |
| Données dans les événements | ✅ | Pas de données sensibles dans les payloads |

**Résultat : PASS**

## 10. Configuration et déploiement

| Point | Statut | Détail |
|---|---|---|
| Secrets en variables d'env | ✅ | Aucun secret dans le code |
| HTTPS | ✅ | Traefik avec Let's Encrypt |
| Headers de sécurité | ⚠️ | CSP, HSTS, X-Frame-Options à vérifier |
| Debug mode | ✅ | Désactivé en production |
| Source maps | ⚠️ | Vérifier qu'elles ne sont pas exposées en prod |

**Résultat : PASS (avec recommandations)**

---

## Résumé des vulnérabilités

### Critiques : 0
### Hautes : 0
### Moyennes : 3
1. Pas de rate limiting sur toutes les routes admin et publiques
2. Pas de vérification explicite de l'Origin header sur toutes les routes
3. Headers de sécurité (CSP, HSTS) à vérifier

### Basses : 2
1. `console.error` peut logger des détails en dev
2. Source maps à vérifier en production

## Recommandations prioritaires

1. **Rate limiting** : étendre le rate limiting à toutes les routes API (pas seulement auth).
2. **Headers de sécurité** : configurer CSP, HSTS, X-Frame-Options, X-Content-Type-Options dans `next.config.mjs` ou le middleware.
3. **Vérification Origin** : ajouter une vérification de l'Origin header sur les routes sensibles.
4. **Logging** : s'assurer que les logs ne contiennent pas de données PII en production.

## Conclusion

L'application présente un niveau de sécurité **solide** pour un SaaS institutionnel. Les contrôles d'authentification et d'autorisation sont bien implémentés. Les principales recommandations concernent le rate limiting et les headers de sécurité, qui sont des améliorations défensives plutôt que des vulnérabilités critiques.

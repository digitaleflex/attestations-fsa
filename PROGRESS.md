# 📊 État d'Avancement du Projet - Attestations FSA

**Date** : 22 septembre 2026
**Statut** : ✅ Vérifié par exécution (voir « Preuves de vérification » ci-dessous)

> ⚠️ **Réalignement 2026-09-22** : ce document remplace l'instantané du 9 avril 2026.
> Les modules **Chat, Ressources pédagogiques, Portfolio et Waitlist** ont été
> **retirés du produit le 2026-06-22** (commit `960852f`) : leurs références et leurs
> lignes ont été supprimées ci-dessous. L'ancienne « Progression Globale ~79 % » n'est
> plus maintenue : elle n'était pas reproductible. Tous les chiffres actuels proviennent
> des commandes listées dans ce document — aucune valeur estimée.

---

## ✅ Preuves de vérification (mesurées le 2026-09-22)

| Vérification | Commande | Résultat |
| :--- | :--- | :--- |
| Types | `npx tsc --noEmit` | **0 erreur** |
| Lint | `npx eslint .` | **0 erreur** |
| Tests | `npx vitest run --coverage` | **942 tests verts / 152 fichiers** |
| Couverture | idem | **61,72 % lignes · 60,88 % statements · 54,92 % branches · 64,41 % functions** |
| E2E | Playwright (`pnpm e2e:setup` puis `pnpm test:e2e`) | **8/8 verts**, sans variable d'environnement, **dont un passage sur base détruite puis recréée de zéro** (6,9 min) |
| CI | `.github/workflows/test.yml` | 3 jobs : `quality` (tsc + eslint, bloquant), `test` (audit dépendances + couverture), `e2e` (postgres 5434 + migrations + seed + Playwright) |
| Ratchet couverture | `vitest.config.ts` | seuils `10/9/12/10` → **`59/53/63/60`** (mesuré : 60,88 / 54,92 / 64,41 / 61,72), garde-fou prouvé actif |

> ⚠️ **Limite honnête** : le job `e2e` de la CI a été écrit et validé **en local**
> uniquement. Il **n'a pas encore tourné sur un runner GitHub**. Les 8/8 E2E
> ci-dessus sont donc locaux.

---

## 🎯 Résumé par Catégorie

> Les pourcentages de ce tableau sont **indicatifs** (hérités de l'analyse d'avril 2026)
> et n'ont **pas** été re-mesurés le 2026-09-22. Seuls les chiffres de la section
> « Preuves de vérification » sont mesurés. Les modules retirés le 2026-06-22 ne
> figurent plus ci-dessous.

| Catégorie | Progression | Statut |
|-----------|-------------|--------|
| 🔐 Authentification | 100% | ✅ Complet |
| 🔐 Authentification 2FA | 100% | ✅ Complet |
| 🛡️ Sécurité | 95% | ✅ Complet |
| 📊 Dashboard Admin | 95% | ✅ Complet |
| 🌐 Pages Publiques | 90% | ✅ Complet |
| 📝 Gestion des Examens | 90% | ✅ Complet |
| ⚙️ Paramètres | 90% | ✅ Complet |
| 📜 Gestion des Attestations | 85% | ✅ Complet |
| 🎓 Résultats & Transcripts | 80% | ✅ Complet |
| 📞 Contact & Support | 80% | ✅ Complet |
| 🔒 Sécurité | 95% | ✅ Complet |
| ✏️ Demandes de Correction | 80% | ✅ Complet |
| 💼 Gestion des Stages | 75% | ⚠️ Améliorable |
| 🔔 Notifications | 70% | ⚠️ Améliorable |
| 🛡️ Anti-Triche | 70% | ⚠️ Améliorable |
| 📋 Audit Logging | 65% | ⚠️ Améliorable |
| 📹 Monitoring Examen | 40% | 🔧 Partiel |
| 🧪 Tests | Couverture 61,72 % lignes | ⚠️ En consolidation (942 tests verts) |

---

## ✅ Corrections de Sécurité (Avril 2026)

### Terminées
- ✅ **Fonction `getAdminUser()` atomique** - Élimine incohérences auth/identité
- ✅ **Typage renforcé de `getUserRole()`** - Sécurité TypeScript améliorée
- ✅ **Uniformisation des routes API admin** - Pattern de sécurité cohérent (32 routes admin comptées le 2026-09-22)
- ✅ **Audit logs ajoutés sur routes sensibles** - Traçabilité complète
- ✅ **Type `AuditAction` étendu** - 17 nouvelles actions typées
- ✅ **4 rate limits admin** - Protection contre abus (bulk, notifications, settings, login)
- ✅ **Authentification 2FA pour admins** - Plugin `twoFactor` Better Auth (`lib/auth.ts`), pages `app/admin/2fa/setup` et `app/admin/2fa/verify`
- ✅ **Zéro erreur TypeScript** - Confirmé le 2026-09-22 (`npx tsc --noEmit` → 0 erreur)

### En Attente / Non revérifié
- ⏳ Réduction durée session admin (30min inactivité) — non revérifié
- ⏳ Whitelist IP pour accès admin (production) — non revérifié
- ✅ ~~Tests unitaires et d'intégration~~ → **942 tests verts** le 2026-09-22
- ⏳ Forçage 2FA pour TOUS les admins — 2FA admin présente, forçage global **non vérifié**

---

## 🚨 Problèmes Critiques Restants

1. **~146 usages explicites de `any`** (grep `: any` / `as any` / `<any>` sur `app lib components`, mesuré le 2026-09-22 ; ~165 en comptant toutes les occurrences du mot). La règle `@typescript-eslint/no-explicit-any` est désactivée (`eslint.config.mjs:31`).
2. **Couverture de tests à 61,72 % lignes** (942 tests verts) — en consolidation, encore insuffisante pour du production-grade.
3. **Origines de confiance trop permissives** (`https://*.vercel.app`, `lib/auth.ts:65`).
4. **Session longue** (30 jours, `lib/auth.ts:199`).

---

## 📈 Fonctionnalités Principales

### Authentification & Autorisation
- ✅ Inscription/connexion email-mot de passe
- ✅ Vérification email par OTP
- ✅ Récupération mot de passe
- ✅ Rôles ADMIN/USER avec protection
- ✅ Routes API admin sécurisées
- ✅ Rate limiting actif (Upstash Redis configuré)

### Gestion des Examens
- ✅ Wizard 5 étapes (QCM, questions ouvertes, étude de cas)
- ✅ Types : OFFICIAL, MOCK, INTERNAL
- ✅ Passage étudiant avec timer
- ✅ Correction admin
- ✅ Détection de triche serveur

### Gestion des Attestations
- ✅ 3 types : FORMATION, STAGE, CERTIFICATION
- ✅ Code unique automatique
- ✅ Révocation et rétrogradation
- ✅ Opérations en masse
- ✅ Vérification publique
- ✅ Export Excel

### Admin Dashboard
- ✅ 32 pages de gestion (comptées le 2026-09-22)
- ✅ Statistiques en temps réel
- ✅ Gestion utilisateurs, formations, examens
- ✅ Logs d'audit et monitoring
- ✅ Centre de notifications

---

## 📊 Métriques du Projet

- **Lignes de code** : ~47 648 TS/TSX (`wc -l` sur `app`, `lib`, `components`, 2026-09-22)
- **Routes API** : 87 endpoints (`find app/api -name route.ts` ; dont 32 sous `app/api/admin`)
- **Pages** : 65 (`find app -name page.tsx` ; dont 32 sous `app/admin`)
- **Modèles Prisma** : 22 modèles dans `prisma/schema.prisma` (les modèles des modules retirés n'y figurent plus)
- **Dépendances** : Next.js 16, Better Auth, Prisma, Pusher, Upstash Redis, Resend

---

## 🎯 Prochaines Étapes

### Priorité Haute (Sécurité)
1. Réduire la durée de session admin
2. Restreindre les `trustedOrigins` (retirer `*.vercel.app` en production)
3. Relever la couverture de tests au-delà de 53 %

### Priorité Moyenne (Qualité)
4. Réduire les `any` vers des types génériques

### Priorité Basse (Améliorations)
5. Monitoring examen côté client
6. Notifications email/SMS
7. Anti-triche avancé

---

**Documentation détaillée** : [`docs/README.md`](./docs/README.md)

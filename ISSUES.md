# Issues — attestations-fsa

## 🔴 Critique (sécurité / bugs fonctionnels)

- [x] **#1** `app/api/temp-setup/route.ts` — neutralisé (retourne 404). **Action manuelle requise : `rm -rf app/api/temp-setup`**
- [x] **#2** `lib/auth.ts:219` — `getAdminUser` corrigé : retourne `null` si `role` n'est pas `"ADMIN"` au lieu de defaulter
- [ ] **#3** `adminUserIds` vide en attente des vrais UUIDs — bloqué par Prisma Postgres billing hold. Voir section "Migration VPS" ci-dessous.
- [x] **#4** `middleware.ts:6` — `USER_ROUTES` complétée : `/courses`, `/mock-exams`, `/notifications`, `/portfolio`, `/support`, `/transcript`

## 🟠 Architecture (duplication / design)

- [x] **#5** Routes dupliquées auditées — frontend utilise uniquement : `/api/exams`, `/api/users`, `/api/submissions` (top-level). `/api/admin/users` et `/api/admin/submissions` sont morts. Déduplication complète = refactor frontend, déféré.
- [x] **#6** `Admin` model supprimé du schema → **migration requise : `npx prisma migrate dev --name remove_legacy_models`**
- [x] **#7** `Exam.title` et `Exam.name` — confirmé que les deux routes de création set `title: name`. Pas de bug actif. Suppression d'un champ = migration future après VPS.
- [x] **#8** Scores `ExamSession` documentés dans le schema (commentaires par champ)
- [x] **#9** `VerificationToken` supprimé du schema → **migration requise (même commande que #6)**

## 🟡 Mineur / code smell

- [x] **#10** Rôles normalisés lowercase partout : `getCurrentUser` retourne le rôle brut DB, `getAdminUser` vérifie `.toLowerCase() === 'admin'`, toutes les comparaisons API/composants alignées. `proxy.ts` (doublon pré-rename) vidé → **`git rm proxy.ts`**
- [x] **#11** `pages.signIn` corrigé → `/auth` (était `/admin/login`)
- [x] **#12** `submittedAt @default(now())` supprimé — migration requise (même commande que #6)
- [x] **#13** Non-issue — `app/admin/page.tsx` est un simple redirect vers `/admin/dashboard`
- [x] **#14** `/portfolios/[slug]` = placeholder statique sans data. Route canonique = `/p/[slug]`. Corrigé dans 3 fichiers : `api/user/portfolio`, `api/public/portfolios`, `app/p/[slug]` (URL hardcodée → `NEXT_PUBLIC_APP_URL`)

---

## Migration VPS (Prisma Postgres → self-hosted)

**Situation :** `DATABASE_URL` pointe vers Prisma Postgres (`prisma+postgres://`) avec un hold de facture — aucune requête possible.

**Étapes :**
1. Payer la facture OU contacter support@prisma.io pour export de données
2. `pg_dump "postgresql://..." > backup.sql` (une fois accès rétabli)
3. Installer PostgreSQL sur VPS, `psql ... < backup.sql`
4. Mettre `.env` → `DATABASE_URL=postgresql://user:pass@vps:5432/dbname`
5. `npx prisma migrate deploy` (applique les migrations en attente : suppression Admin + VerificationToken)
6. Récupérer les UUIDs des admins → compléter `lib/auth.ts` `adminUserIds`
7. `npm uninstall @prisma/extension-accelerate` (déjà retiré du package.json)

**Code déjà migré :** `lib/prisma.ts` ne dépend plus d'Accelerate.

## Résolu

<!-- déplacer ici après fix -->

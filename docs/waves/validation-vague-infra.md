# Validation — vague infra (livrée 2026-10-07 → 2026-10-08)

> Périmètre : tout ce qui a été livré côté **infra/prod + conformité/données + tests** depuis la réconciliation `sec/vague-a-p0`, re-vérifié contre le code réel le 2026-10-08 dans le cadre de l'issue #323.
> Méthode : chaque item porte sa preuve `chemin:ligne` **constatée dans l'arbre** et le hash du commit livrant. Les comptes de tests cités sont ceux déclarés dans les messages de commit (non rejoués ici). Lecture seule sur le code : aucune modification hors `docs/` dans ce rapport.

## Vague 2 — Sceau, preuve et document officiel : LIVRÉE côté code

| # | Preuve constatée | Commit |
|---|---|---|
| #307 | Module versionné `lib/attestations/pdf-generator/index.ts` (246 L, QR vers `/verifier?code=…`) ; câblé `compose.prod.yml:63`, `.env.production:74,80`, `.env.example:157` | `f73f3b4` 2026-09-28 |
| #300 | `sealVersion: 2` sur toutes les voies : `app/api/attestations/route.ts:278,291-293`, `lib/stage-attestation/issue.ts:319,351-353` ; garde `getSealSecret()` `:165`, `:290` | `aba91c6` 2026-09-28 |
| #302 | `lib/attestations/issue.ts:156` — refus d'émission si PII fictives | `6e343d3` 2026-09-28 |
| #316 | Séquence `prisma/migrations/202609280_attestation_code_sequence/migration.sql:6` + `nextval()` atomique `lib/attestations/issue.ts:243-247`, `app/api/attestations/route.ts:219-223` | `6e343d3` + `aba91c6` |
| #322 | Invariants 400 par type + rejet `certificationHoursExempted` `app/api/attestations/route.ts:119-147` ; tests `tests/api/attestation-by-id.test.ts` | `5817a3d` 2026-10-07 |
| #305 | Domaine lu depuis `NEXT_PUBLIC_APP_URL` `lib/auth.ts:96-99,195`, `compose.prod.yml:31,41` (`TRAEFIK_HOST`, défaut `hashcode.cloud`), QR réactivé | `85983a0` + `4e7ecca` |

**Reste** : #141 (E2E sur PDF officiel réel + QR gravé), verdict #309 (registre public des révocations absent, `ATTESTATION_REJECTED` inutilisée `prisma/schema.prisma:620`), preuve d'émission `CERTIFICATION` en prod (**action humaine**).

## Vague 3 — Parcours stages : LIVRÉE côté code

| # | Preuve constatée | Commit |
|---|---|---|
| #264 | `cvUrl` restreint au HTTPS `app/api/user/internships/route.ts:13-17` + `sanitizeInput` sur tous les champs `:134-138` ; voie publique sanitizée `app/api/public/internships/route.ts:93-96` | `6e343d3` + `aba91c6` |
| #269 | `retentionUntil` honorée : `lib/jobs/retention-purge.ts:89-96` (échus non officiels, `isOfficialStoredObject` protège les PDF), `POST /api/internal/retention/purge/route.ts:18-19` (`CRON_SECRET`, GET 405), `tests/lib/retention-purge.test.ts` (182 L) | `1bfab89` 2026-10-08 |
| #270 | Compteur + `stageScore` UI `app/admin/internships/page.tsx:71,133-135` + API | `aba91c6` |
| #272 | `e2e/parcours-stage.e2e.ts` (230 L) + `e2e/parcours-admin.e2e.ts` (211 L) | `281c900` 2026-10-08 |

**Reste** : vert CI à constater (**action humaine/CI**), migration des `cvUrl` existants à confirmer en base, cohérence UI/API fine (#270), quotas par compte → #320.

## Vague 4 — Hardening web : LIVRÉE côté code (sauf #289)

| # | Preuve constatée | Commit |
|---|---|---|
| #290 | Nonce par requête `proxy.ts:88-95`, `script-src 'nonce-…' 'strict-dynamic'`, `img-src 'self' data: blob:` `:93`, `connect-src` restreint `:95`, `x-nonce` `:129-131` ; CSP statique retirée `next.config.mjs:112-131` | `d40a77e` 2026-09-28 |
| #284 | Reliquat `img-src` résorbé par #290 (plus de `https:` générique) ; `next-image` : `next.config.mjs:51-77` + `tests/config/next-image-remote-patterns.test.ts` | `d40a77e` |
| #289 | PARTIEL : `sanitizeInput` branché (`aba91c6`, constaté sur 2 routes stages) ; **aucun DOMPurify** : allowlist HTML sur champs riches toujours absente | — |

## Vague 5 — Staging + fenêtre de migration : STAGING LIVRÉ, fenêtre ouverte

| # | Preuve constatée | Commit |
|---|---|---|
| #156 | `compose.staging.yml` (Postgres dédié `:92-103`, healthcheck `/api/ready` `:67-71`), gate staging→prod `.github/workflows/deploy.yml:102-180` | `ebeea12` 2026-10-07 |
| #22 | Images GHCR taguées par SHA `compose.prod.yml:10`, jobs `build-and-push`/`deploy-staging`/`deploy-prod` `:49-180` | `ebeea12` |
| #294 | Job `rollback` `.github/workflows/deploy.yml:280-320` (retour tag précédent + smoke test `/api/ready` `:320`) | `ebeea12` |

**Reste** : rollback vu tourner (**action humaine**). Toujours ABSENT (grep à 0) : #308 (`sealKeyId`/`SigningKey`) et #312 (outbox) — à écrire puis valider sur staging.

## Vague 6 — Plateforme et exploitation : LIVRÉE côté code

| # | Preuve constatée | Commit |
|---|---|---|
| #292 | `app/api/ready/route.ts:1-46` (PostgreSQL `:9-20`, Redis optionnel `:22-38`, 200/503 `:40-45`) ; healthchecks basculés `compose.prod.yml:87-91`, `compose.staging.yml:67-71` ; issue GitHub #292 **CLOSED** | `6e343d3` |
| #295 | `.github/workflows/backup-monitor.yml:12-100` (cron `0 5 * * *`, fraîcheur + versioning R2 + `/api/ready`, alerte issue `backup-alert` `:78-100`), `docs/ops/backup-monitoring.md`, `.env.example:116-126` | `d498cfd` 2026-10-08 |
| #21 | `.env.production` injecté via flux SSH, plus de SCP en clair `scripts/deploy-to-vps.sh:146-148` | `8d8023c` 2026-10-08 |
| #151 | Sentry **supprimé sur décision** `1c63f0a` (0 référence dans app/lib/workflows/Docker/compose) ; observabilité sans SaaS `docs/ops/procedures.md` (`caa2950`) | `1c63f0a` 2026-10-07 |

**Restent (actions humaines)** : secrets GitHub R2, monitor uptime externe (`docs/ops/procedures.md:477`), `BACKUP_REMOTE` + `BACKUP_AGE_RECIPIENT` + RPO/RTO + drill (#306), rotation des secrets (#21), renommage `tests/api/ready.test.ts` + alignement des 9 docs `/api/ready` (vague 8).

## Vague 7 — Conformité et données : LIVRÉE côté code (sauf #320/#321/#317-fin)

| # | Preuve constatée | Commit |
|---|---|---|
| #153 | Voir #269 (purge RGPD) + politique `docs/legal/retention-policy.md` | `1bfab89` |
| #291 | Fini la suppression physique : `DELETE app/api/users/[id]/route.ts:544-693` anonymise (`:639-642`), révoque les sessions (`:624`), purge les credentials (`:629-637`), audite `ACCOUNT_ANONYMIZED` **dans la transaction** (`:649-693`), protège l'auto-effacement et le dernier admin (`:562-606`) | (arbre actuel) |
| #313 + #347 | Placeholders remplacés (`aba91c6`), hébergeur complété + promesses reformulées (`app/(public)/legal/attestations/page.tsx`, `app/(public)/faq/page.tsx`) | `aba91c6` + `ff73536` 2026-10-07 |
| #318 | `expiresAt` `prisma/schema.prisma:343-360` + migration `20261007_exam_session_expires_at`, cron `lib/exams/cron-expire.ts:102-135` (audit `EXAM_SESSION_EXPIRED`), posé à la création `app/api/exams/[id]/start/route.ts:152-163`, reprise `EXPIRED` bloquée `:123` | `6d442bc` 2026-10-07 |
| #319 | Catégorie + description exigées, dédup normalisée, création auditée `app/api/attestations/route.ts:38-40,173-204` | `820986b` 2026-10-07 |

**Restent (actions humaines)** : export préalable RGPD à décider (#291), registre des traitements + consentements à trancher (#153, aucune issue ouverte), revue juridique externe à signer (#313/#347). Reste code : #320, #317 (38 `toLocaleString` + XLSX — `lib/exams/schedule-ui.ts:24-31` lit déjà `APP_TIMEZONE`), #321 (logs structurés, `request-id`, scrub PII).

## Vague 8 / transverse — Docs, tests, UX : PARTIELLE

| # | Preuve constatée | Commit |
|---|---|---|
| #297 | « 85 % – Production » remplacé par l'état réel, inventaire recalculé (OPS-02 livrée, OPS-10 partielle), bloc `.dark` mort supprimé | `e414890` 2026-10-08 |
| #76 | Références legacy supprimées, 0 occurrence (`app/api/users/[id]/route.ts`, `lib/account-status.ts`, `types/index.ts`) — sorti des gelées, sans migration | `aaf1308` 2026-10-07 |
| #11 | `.env.test` + `tests/helpers/{auth,db,fixtures,mocks}.ts` + `tests/setup.ts` + `tests/api/admin-2fa.test.ts` (380 L) + `tests/lib/error-translator.test.ts` | `5ea9f72` 2026-10-08 |
| #131 | Filet en place : 71 fichiers `tests/api/`, suites `tests/lib/**`, 5 specs `e2e/`, ratchet `vitest.config.ts:47-51` | — |
| #138 | PARTIEL : `tests/api/public-settings.test.ts` (132 L) ; antérieurs `c12ed25`, `1e71b04` | `5dd07b9` 2026-10-08 |
| #140 | Specs `e2e/parcours-admin.e2e.ts` (211 L) ; reste vert CI + cas détaillés (dépend #311) | `281c900` |
| #349 | SEO/prod : `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, metadata `app/(public)/layout.tsx:7-25` | `999f5ac` 2026-10-07 |
| UX | 6 micro-bugs (QR, print, durée examens, recherche formations, 404, a11y) + catalogue formations + détail `[slug]` (`aa5c59a`, dont #335–#337, #339, #350) | `9a40ab2`, `aa5c59a` 2026-10-08 |

**Restent** : #147 (contrat agents), CI documentation ↔ code, clôtures #148/#131/#323, validation humaine #159 (`docs/decisions-bloquantes.md` = RECOMMANDATIONS, `DÉCISION RECOMMANDÉE` postées en commentaires d'issues) puis #280 avant la rotation #308.

## Non-livré confirmé (re-vérifié, pas de faux FAIT)

- **#308** : `grep sealKeyId|SigningKey app lib prisma/schema.prisma` = 0 → toujours ABSENT.
- **#312** : `grep outbox app/ lib/ prisma/` = 0 → toujours ABSENT.
- **#293** : `app/admin/logs/page.tsx` n'existe pas, `take: 200` en dur → toujours PARTIEL.
- **#314** (funnel) : NC, rien constaté.
- **Vague 1** (#311 source unique + audit `USER_RETROGRADED`/`USER_MANAGEMENT` à 0 usage, #286, reliquat #304) : aucun code constaté → non démarrée.

## Commits livrants (chronologie)

| Hash | Date | Sujet |
|---|---|---|
| `6e343d3` | 2026-09-28 | #316 #292 #264 #317 #302 — séquence PG, /api/ready, CV URLs, fuseau, PII fictives |
| `aba91c6` | 2026-09-28 | #300 #313 #289 #270 — sceau v2, pages légales, sanitizeHTML, UI stages |
| `f73f3b4` | 2026-09-28 | #307 — module PDF officiel |
| `d40a77e` | 2026-09-28 | #290 — CSP dynamique avec nonce |
| `999f5ac` | 2026-10-07 | SEO : sitemap, robots, manifest, metadata (#349) |
| `aaf1308` | 2026-10-07 | #76 — retrait des colonnes legacy |
| `caa2950` | 2026-10-07 | Observabilité sans SaaS (#151) |
| `ebeea12` | 2026-10-07 | Staging + GHCR + rollback (#22 #156 #294) |
| `ff73536` | 2026-10-07 | Promesses juridiques (#347) |
| `5817a3d` | 2026-10-07 | Invariants attestations (#322) |
| `820986b` | 2026-10-07 | Catalogue formations (#319) |
| `6d442bc` | 2026-10-07 | Expiration sessions d'examen (#318) |
| `1c63f0a` | 2026-10-07 | Suppression Sentry (#151) |
| `8d8023c` | 2026-10-08 | Secrets via SSH (#21) |
| `d498cfd` | 2026-10-08 | Monitoring R2 + readiness (#295) |
| `1bfab89` | 2026-10-08 | Purge RGPD (#153/#269) |
| `281c900` | 2026-10-08 | E2E admin + stage (#140 #272) |
| `9a40ab2` | 2026-10-08 | 6 micro-bugs UX |
| `5ea9f72` | 2026-10-08 | Infra de tests (#11) |
| `e414890` | 2026-10-08 | Réconciliation docs (#297) |
| `aa5c59a` | 2026-10-08 | UX catalogue formations (#335–#337, #339, #350) |
| `5dd07b9` | 2026-10-08 | `GET /api/public/settings` (#138) |

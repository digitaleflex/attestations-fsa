# Issues — attestations-fsa

> **Source de vérité : GitHub Issues** (`gh issue list`). Ce fichier est un miroir
> de suivi local, mis à jour après chaque merge. Dernière synchro : **2026-10-17** (état réel vérifié via `gh issue view`).

---

## ✅ Résolues (fermées sur GitHub, code mergé sur `main`)

### Sprint stabilité / infra (sept. 2026)

| Issue | Titre                                                           | Fix (commit / PR)                          |
| :---- | :-------------------------------------------------------------- | :----------------------------------------- |
| #20   | Sécurité : trier les 161 alertes Dependabot                     | `9134fdc`, `48777b0`, `5fb5eb1`, `b357304` |
| #24   | Observabilité : endpoints `/api/health` et `/api/ready`         | PR #169 (`8978d95`)                        |
| #30   | Prisma : index unique sur `TwoFactor.userId`                    | PR #170 (`75b882f`)                        |
| #31   | Route `/portfolios` manquante — lien footer 404                 | PR #166 (`80f1c82`)                        |
| #32   | `pnpm lint` cassé : `next lint` retiré dans Next 16             | PR #165 (`6eebf8b`)                        |
| #66   | Tests d'or du cœur (scoring, submit, attestation, vérification) | PR #172 (`9a6a2ad`)                        |
| #79   | Migrer `middleware.ts` → `proxy.ts` (Next.js 16)                | PR #167 (`89c854e`)                        |
| #80   | Supprimer le lockfile npm obsolète (`package-lock.json`)        | PR #168 (`ec659a3`)                        |
| #132  | Infrastructure de test & CI (vitest unifié, coverage, gate PR)  | PR #171 (`b0d096c`)                        |

### Cœur métier (bugs critiques / majeurs)

| Issue | Titre                                                             | Fix (commit)                                           |
| :---- | :---------------------------------------------------------------- | :----------------------------------------------------- |
| #113  | [CRITIQUE] Anti-triche client désactivé (userId manquant)         | PR #173 (`b450076`)                                    |
| #116  | [CRITIQUE] Attestation jamais mise à jour ni révoquée            | PR #174 (`4655169`)                                    |
| #117  | [CRITIQUE] Examen GRADED avec parties 2/3 non corrigées         | PR #175 (`issue-117-graded-parts-sentinel`)            |
| #118  | [MAJEUR] Dénominateur / sélection de la partie QCM incohérents  | PR #176 (`issue-118-qcm-denominator`)                  |
| #121  | [MAJEUR] Unicité `ExamSession(userId, examId)` manquante        | PR #177 (`issue-121-exam-session-unique`)              |
| #119  | [MAJEUR] Aucune contrainte serveur de durée d'examen            | PR #178 (`issue-119-exam-duration`)                    |
| #123  | [MAJEUR] `passingScore` entier / défaut UI 60 vs backend 65     | PR #179 (`issue-123-passing-score`)                    |
| #126  | [MAJEUR] Fuseau horaire de `scheduledAt`                        | PR #180 (`issue-126-scheduled-tz`)                     |
| #122  | [MAJEUR] `showResults` contourné par le transcript              | PR #181 (`issue-122-transcript-showresults`)           |
| #120  | [MAJEUR] Snapshot `_customBareme` non lu sur le détail résultat | PR #182 (`issue-120-custom-bareme`)                    |
| #125  | [MAJEUR] Admin : corrigé = GRADED seulement (pas COMPLETED)     | PR #183 (`issue-125-graded-completed`)                 |
| #128  | [MAJEUR] Réponse partie 3 inaccessible pour la correction       | PR #184 (`issue-128-part3-answers`)                    |
| #124  | [MAJEUR] `internshipScore` exclu de la moyenne/réussite         | PR #185 (`issue-124-internship-score`)                 |
| #129  | [MAJEUR] Faux positifs anti-triche                              | PR #186 (`issue-129-anti-cheat`)                       |
| #130  | [MINEUR] Schéma, API & affichage (m1–m12)                       | PR #187 (`issue-130-schema-api-display`)               |
| #114  | [CRITIQUE] Le chrono soumet `{}` — perte de toutes les réponses   | `e42dc24` (merge `fix/issue-114-exam-timer-submit-v2`) |
| #115  | [CRITIQUE] Mention du certificat calculée sur la mauvaise échelle | `1d6d096` (cherry-pick `6c8c15f`)                      |
| #127  | [MAJEUR] Trois règles de mention divergentes                      | `1d6d096` (cherry-pick `6c8c15f`)                      |

### Anciennes issues locales (numérotation legacy, toutes vérifiées dans le code)

Toutes les entrées de l'ancien `ISSUES.md` (#1–#14) sont **résolues dans le code** :

- ✅ #1 `app/api/temp-setup` — supprimé (n'existe plus)
- ✅ #2 `getAdminUser` — retourne `null` si rôle ≠ `ADMIN` (`lib/auth.ts:230`)
- ✅ #3 `adminUserIds` — alimenté via `ADMIN_USER_IDS` (env), plus de placeholder vide
- ✅ #4 `USER_ROUTES` — complétée dans `proxy.ts` (ex-`middleware.ts`)
- ✅ #5 Routes API dupliquées — audit fait, frontend sur les routes top-level
- ✅ #6 `Admin` model — supprimé du schéma Prisma
- ✅ #7 `Exam.title` / `Exam.name` — pas de bug actif (les deux routes set `title: name`)
- ✅ #8 Scores `ExamSession` — documentés dans le schéma
- ✅ #9 `VerificationToken` — supprimé du schéma
- ✅ #10 Rôles normalisés lowercase partout
- ✅ #11 `pages.signIn` → `/auth`
- ✅ #12 `submittedAt @default(now())` — supprimé
- ✅ #13 `app/admin/page.tsx` — simple redirect, non-issue
- ✅ #14 `/portfolios/[slug]` — corrigé (URL → `NEXT_PUBLIC_APP_URL`) — **obsolète depuis : la page `/portfolios/[slug]` a été supprimée du produit le 2026-06-22 (`960852f`) et n'existe plus**

---

## ✅ Dégraissage v2 (EPIC #87) — CLOS

- **EPIC #87 fermé**, les 24 sous-issues #88–#111 sont toutes fermées :
  lots A→M (routes mortes, composants orphelins, Pusher→polling, anti-triche,
  Prisma, feedback 4→2, QA non-régression) + C1–C3, I1–I3, J1–J3, K1–K2.

## 🟡 Qualité / tests / audits (EPIC #131) — EN COURS

### ✅ Corrigées (11)
| Issue | Titre | PR |
| :---- | :---- | :- |
| #133  | [T2] Tests unitaires cœur (scoring, availability, issue) | #188 |
| #134  | [T3] Tests libs support (sanitization XSS, audit) | #191 |
| #135  | [T4] Isolation des données (403) + transcript détail | #190 |
| #136  | [T5] Parcours cœur submit→correct→attestation | #193 |
| #142  | [A1] Audit sécurité OWASP (headers CSP/HSTS, CSRF factice retiré) | #189 |
| #143  | [A2] Audit deps SCA (deps inutilisées + job CI SCA) | #192 |
| #144  | [A3] Audit a11y (skip-link WCAG 2.4.1) | #194 |

### ✅ Corrigées
- **#137 [T6]** : ✅ **fermée** (PR #195-#206, 9 incréments — couverture admin **12,56 % → 69,15 % stmts / 70,53 % lignes**, objectif ≥70 % atteint).
- **#139 [T8]** : ✅ **fermée** (E2E parcours candidat Playwright).
- **#145 [A4]** : ✅ **fermée** (PR #198 — N+1 monitoring → createMany + rapport perf rafraîchi). Dette documentée : `force-dynamic` global, ratio client components 60/65.
- **#146 [A5]** : ✅ **fermée** (PR #199 — script `check-data-integrity.ts` + rapport `docs/data_integrity_audit.md`).

### 🟠 Ouvertes (3 restantes)
- **#138 [T7]** : notifications/stages/réclamations couverts ; reste feedback + settings public.
- **#140 [T9]** : E2E parcours admin (Playwright).
- **#141 [T10]** : documents PDF / QR / impression / vérification.

## ✅ Design (EPIC #42) & Responsive (#34) — CLOS

- **EPIC #42 et #34 fermés** : les 30 issues #35–#64 sont toutes fermées
  (responsive #35–#41 ; refonte V0→V3 #43–#64 : tokens, primitives, layouts,
  écrans, documents imprimables).
- Le nouveau backlog UX/UI est porté par les issues #335–#361.

## 🚀 Production M8 (EPIC #148) — EN COURS

### ✅ Fermées
- #149 stockage objet (modèle `StoredObject`), #150 reprise des données, #152 runbook,
  #154 canal SMS, #155 valeur probante du certificat (signature/scellement),
  #157 exercice de restauration, #158 KPI produit, #160 livrable vertical.

### 🟠 Ouvertes (4 restantes)
- **#151** observabilité & alerting (Sentry + uptime)
- **#153** conformité données personnelles (rétention, effacement, chiffrement)
- **#156** environnement de staging + migrations/rollback
- **#159** trancher les décisions bloquantes

## ✅ Dette historique résolue (EPIC #78 & divers)

- #7–#14 : features fantômes / auto-save / monitoring / PDF / graphiques / tests / types → **fermées**
- #21 secrets hors `.env.production` → **fermée** (gitignore + gate CI `env-guard` + `chmod 600`)
- #22 CI/CD build hors prod + GHCR tagué SHA + rollback → **fermée** (`deploy.yml` : `workflow_run` → `build-and-push` → `deploy-staging` → `deploy-prod` → `rollback`)
- #76 nettoyage Prisma (modèles obsolètes) → **fermée** (`Admin`, `VerificationToken`, `Resource` retirés et tracés dans `schema.prisma`)

## 🔴 CI — corrigé le 2026-10-17 (`a85c52e`)

- **#370** `awscli` absent des dépôts Ubuntu 24.04 → installé via `pipx` (fallback `pip --user`)
- **#371** job `notify` sans `checkout` → `--repo "$GITHUB_REPOSITORY"` sur toutes les commandes `gh`
- Bonus hygiène : `playwright-report/` + `test-results/` ajoutés aux ignores ESLint
  (~3 300 faux positifs supprimés), directives `eslint-disable` mortes retirées de `lib/redis.ts`

---

## 📌 État du repo au 2026-10-17

- **Gate** : `pnpm verify` vert — `tsc` 0 erreur, `eslint` 0 erreur / 0 warning, **1 535 tests** (144 fichiers).
- **Issues ouvertes restantes : 43** (backlog produit légitime), dont 2 EPIC de suivi ouverts
  (#131 qualité, #148 production) et le plan de remédiation #323.

## Prochaines actions

1. **P0 production** : #151 (Sentry/uptime), #153 (RGPD), #156 (staging), #159 (décisions bloquantes) — EPIC #148
2. **Qualité** : #138, #140, #141 — EPIC #131
3. **Backlog UX/produit** : #335–#361 (formations, auth V2, mobile, SEO, prod, légal)
4. **Docs** : #297 — réconcilier la documentation avec le produit réel
   (ex. `analysis_fsa_status.md` référence encore `CompositionScan` et des routes
   `submissions/[id]/scans` qui n'existent plus dans le schéma ni dans `app/`)

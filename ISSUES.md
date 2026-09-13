# Issues — attestations-fsa

> **Source de vérité : GitHub Issues** (`gh issue list`). Ce fichier est un miroir
> de suivi local, mis à jour après chaque merge. Dernière synchro : **2026-09-12**.

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
- ✅ #14 `/portfolios/[slug]` — corrigé (URL → `NEXT_PUBLIC_APP_URL`)

---

## 🟠 Ouvertes — Dégraissage v2 (EPIC #87)

- #88–#111 : lots A→M (routes mortes, composants orphelins, Pusher→polling,
  anti-triche, Prisma, feedback 4→2, QA non-régression)

## 🟡 Qualité / tests / audits (EPIC #131)

### ✅ Corrigées (7)
| Issue | Titre | PR |
| :---- | :---- | :- |
| #133  | [T2] Tests unitaires cœur (scoring, availability, issue) | #188 |
| #134  | [T3] Tests libs support (sanitization XSS, audit) | #191 |
| #135  | [T4] Isolation des données (403) + transcript détail | #190 |
| #136  | [T5] Parcours cœur submit→correct→attestation | #193 |
| #142  | [A1] Audit sécurité OWASP (headers CSP/HSTS, CSRF factice retiré) | #189 |
| #143  | [A2] Audit deps SCA (deps inutilisées + job CI SCA) | #192 |
| #144  | [A3] Audit a11y (skip-link WCAG 2.4.1) | #194 |

### 🟠 Partielles / ouvertes
- **#137 [T6]** : 2 incréments mergés (PR #195 + #196 — 34 tests : actions attestation, settings, profil, examens détail, corrections) ; couverture admin **24,92 %** vs objectif 70 % — reste scans, notifications, bulk-actions, internships, dashboard.
- #138–#141 : tests T7→T10 (E2E Playwright, documents, etc.)
- #145–#146 : audits A4→A5 (perf, intégrité données)

## 🎨 Ouvertes — Design (EPIC #42) & Responsive (#34)

- #35–#41 : responsive (CRITIQUE → MINEUR)
- #43–#64 : refonte V0→V3 (tokens, primitives, layouts, écrans, documents imprimables)

## 🚀 Ouvertes — Production M8 (EPIC #148)

- #149–#160 : stockage objet, reprise données, observabilité, runbook, conformité RGPD,
  SMS, valeur probante certificat, staging, restauration, KPI, décisions, livrable vertical

## 📋 Ouvertes — Backlog (EPIC #78)

- #7–#14 : features fantômes / auto-save / monitoring / PDF / graphiques / tests / types
- #19, #21, #22, #23, #81–#86 : CI/CD, secrets, backup, QR public, PPR, dark mode, etc.

---

## Prochaines actions de synchronisation

1. ~~Traiter l'EPIC #112 (cœur métier)~~ — **TERMINÉ** : les 11 issues (#119-#130) sont corrigées et mergées (PR #177-#187)
2. Poursuivre le dégraissage v2 (EPIC #87)
3. Monter la couverture tests (EPIC #131) — **228 tests** actuellement, ratchet `10/9/12/10`
4. Décider du sort du pilote design (PR #33, branche `fix/issue-115-mention-unique`)

> ⚠️ La branche `fix/issue-115-mention-unique` contient le pilote design (PR #33)
> **non mergé** — le fix #115/#127 a été cherry-pické sur main (`1d6d096`).

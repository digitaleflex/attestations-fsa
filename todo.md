# TODO — Objectif : cœur métier « 100 % prouvé »

> Créé le **2026-09-22** après un point de situation mesuré (voir §0 « Ce qui est déjà vert »).
> Ce fichier est la **liste de suivi unique** pour atteindre l'objectif.
> Source de vérité des issues : GitHub (`gh issue list`). Ce fichier ne remplace pas les issues : il les ordonne.

---

## 0. Ce qui était déjà vert au démarrage (mesuré, pas supposé)

> ⚠️ **Instantané « AVANT »** — conserve volontairement les chiffres du point de
> situation initial. **L'état livré est en §5** : **942 tests / 152 fichiers**,
> couverture **61,72 % lignes**, ratchet `59/53/63/60`.

| Preuve | Commande | Résultat |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | 0 erreur |
| Lint | `npx eslint .` | 0 erreur |
| Tests unitaires + API | `npx vitest run` | **778/778** (138 fichiers) |
| Cœur logique | `vitest run --coverage` | `exams/scoring` 100 % · `exams/availability` 100 % · `attestations/issue` 100 % · `exam-enforcement` 100 % · `anti-cheat` 92 % |
| **E2E parcours candidat** | `npx playwright test` (base isolée 5434) | **8/8 verts** — auth → examen → score → attestation (code réel) → PDF → vérification publique |
| CI `main` | `gh run list` | Tests + Env Guard + Deploy VPS OK (2026-09-18) |

**Conclusion du point** : la chaîne `examen → résultat → attestation → PDF → vérification publique` **fonctionne**.
L'écart avec « 100 % » est **l'automatisation de la preuve**, pas le code métier.

### Les 2 défauts bloquants constatés

1. **La CI ne prouve rien du cœur** : `.github/workflows/test.yml` ne lance ni `tsc`, ni `eslint`, ni l'E2E
   (uniquement `pnpm audit` + `test:coverage`). Le parcours métier peut casser sans qu'aucun check ne s'allume.
2. **L'E2E n'est pas reproductible** : la base E2E (port 5434 / `attestation_fsa_e2e`) n'est déclarée
   **nulle part** (ni compose, ni script, ni doc). Et `pnpm db:seed` **échoue sur Windows**
   (`TS5023: Unknown compiler option '0'…'3'` — JSON `--compiler-options` déformé par le shell).

> ✅ **Ces 2 défauts sont corrigés** : T1 (CI = 3 jobs : `quality` bloquant, `test`, `e2e`)
> et T3 (service `postgres-e2e` dans compose + scripts pnpm + `tsconfig.seed.json` +
> doc). Preuves au §5 ; re-vérifiés sur base détruite puis recréée de zéro (T12).

---

## 1. Règles de conduite (non négociables)

1. **Un seul écrivain à la fois** sur un fichier donné (voir colonne « Fichiers »).
2. **Aucun commit / push sans demande explicite** de l'utilisateur. Les agents préparent, vérifient, rendent la main.
3. **Pas de « ça devrait marcher »** : chaque tâche rend des **preuves brutes** (commande + sortie réelle).
4. Modèles : FREE d'abord (`opencode/*-free`), puis `opencode-go/*-flash` (abonnement, niveau 4).
   `architect`/`security` = `glm-5.3` (rares, zones sensibles). **Jamais** de `*-max` / `*-pro` / PAYG.
5. Une tâche n'est ✅ que si sa **Preuve attendue** est fournie dans ce fichier (§5 Journal).

---

## 2. Tableau des tâches

### 🟥 VAGUE 1 — Débloquer la preuve (P0) — ✅ **TERMINÉE**

| # | Tâche | Agent(s) | Modèle | Fichiers | Bloque | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| **T1** | **CI : gate + job E2E.** Ajouter à `test.yml` : (a) job `quality` = `tsc --noEmit` + `eslint .` ; (b) job `e2e` = service `postgres:17-alpine` (port 5434 / base `attestation_fsa_e2e`) + `prisma migrate deploy` + seed + `playwright install --with-deps chromium` + `pnpm test:e2e`. Inventorier d'abord les env vars exigées au boot (envalid / `e2e/setup/env.ts`) et les injecter en valeurs factices non secrètes. **FAIT** : jobs `quality` (tsc+lint, bloquant pour `e2e`) + `e2e` (service postgres 5434, migrate, seed, chromium, `pnpm test:e2e`, rapport Playwright en artefact sur échec) ; `permissions: contents: read` ; `E2E_DATABASE_URL` = seule variable obligatoire (`.env.local` absent en CI). | `@eurinhash` | `deepseek-v4.1-flash` | `.github/workflows/test.yml` | — | ✅ |
| **T3** | **E2E reproductible + seed.** (a) service `postgres-e2e` dans `compose.local.yml` (port 5434, base `attestation_fsa_e2e`, crédits alignés sur `e2e/setup/env.ts` qui dérive depuis `.env.local`) ; (b) scripts pnpm `e2e:db:up` / `e2e:db:down` / `e2e:db:migrate` / `e2e:seed` / `e2e:setup` / `e2e` ; (c) **réparer `pnpm db:seed`** via `tsconfig.seed.json` (plus de JSON `--compiler-options` passé au shell) ; (d) prérequis réels documentés dans `docs/testing/guide-tests-e2e.md`. | `@eurinhash` | `deepseek-v4.1-flash` | `compose.local.yml`, `package.json`, `docs/testing/guide-tests-e2e.md`, `tsconfig.seed.json` | — | ✅ |

> T1 et T3 sont **disjoints en fichiers** → exécutés en parallèle.

### 🟧 VAGUE 2 — Couvrir le cœur non testé (P1) — ✅ **TERMINÉE**

| # | Tâche | Agent(s) | Modèle | Fichiers | Bloque | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| **T4** | **Tests `proxy.ts`** : **21,05 % → 100 % lignes** (97,77 % stmts), 24 tests dans `tests/proxy.test.ts`. Comportements réels testés — le proxy ne lit **aucun rôle** (c'est un pré-filtre optimiste sans DB) : deux cas demandés n'existent pas et n'ont pas été simulés. | `@igris` | `deepseek-v4.1-flash` | `tests/proxy.test.ts` | — | ✅ |
| **T5** | **Tests des routes cœur à 0 %** — **TERMINÉ** (2 lots). 11 fichiers `tests/api/*.test.ts` créés. **Toutes les routes listées sont sorties de 0 %** : `attestations/[id]` 94,59 · `submissions/[id]` 100 · `upload` 96,66 · `formations/inscription` 100 · `auth/fsa-login` 96,29 · `user/after-signup` 96,29 · `user/profile` 87,5 · `user/attestations/[id]/claim` 100 · `.../correction` 100 · `user/claim-code` 100 (% lignes). | `@igris` ×2 | `deepseek-v4.1-flash` | `tests/api/*.test.ts` | — | ✅ |
| **T6** | **Tests `lib/email.ts` + `lib/notifications.ts`** : `lib/notifications.ts` **0 → 100 %**, `lib/email.ts` **0 → 85,26 %**. Resend/Pusher mockés (aucun envoi réel). | `@igris` | `deepseek-v4.1-flash` | `tests/lib/email.test.ts`, `tests/lib/notifications.test.ts` | — | ✅ |
| **T7** | **Tests scans de copies** : `scans/[scanId]` **0 → 91,17 %**, `scans/[id]` **13,86 → 86,13 %** (le 13,86 % venait d'une copie `.kilo` périmée, le réel est à 86,13 %). | `@igris` | `deepseek-v4.1-flash` | `tests/api/admin-scans-detail.test.ts` | — | ✅ |
| **T8** | **Relever le ratchet** de couverture dans `vitest.config.ts` — **FAIT, 2 relevés** : (1) exclusion des doublons `.kilo/**` + `Backup/**` + `tmp/**` puis `10/9/12/10` → `51/47/61/52` à 53,25 % de lignes ; (2) après T5b → **`59/53/63/60`** (mesuré 60,88 / 54,92 / 64,41 / **61,72**). **Prouvé actif** : seuil impossible → `exit 1` + `ERROR: Coverage for … does not meet global threshold`. | `@eurinhash` | `deepseek-v4.1-flash` | `vitest.config.ts` | T4–T7 | ✅ |

### 🟨 VAGUE 3 — Hygiène & cohérence (P2) — *après V2*

| # | Tâche | Agent(s) | Modèle | Fichiers | Bloque | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| **T9** | **Hygiène dépôt.** **Partie faite** : `.kilo/worktrees/` (5,0 M) **est déjà ignoré par git** (`.git/info/exclude:9` — le todo disait à tort « non ignorée ») ; il polluait **la couverture** (55 fichiers comptés en double, +8 points artificiels) → **exclu de `coverage.exclude`**. **Reste à décider (toi)** : supprimer la copie `.kilo/` (5,0 M), statuer sur `Backup/` (1,7 M) et `tmp/` (5 Ko). | `@eurinhash` + **toi** | `deepseek-v4.1-flash` | `vitest.config.ts` | — | 🟧 |
| **T10** | **Docs contradictoires corrigés** : `PROGRESS.md` (daté 2026-09-22, chiffres mesurés, 4 modules supprimés le 22/06 retirés — `git log --diff-filter=D` → commit `960852f`), `analysis_fsa_status.md` (correction / signalement / logs d'audit prouvés **existants** par `ls` + tests), `BACKLOG.md` (INF-01/SEC-01/BUG-01 + VER-01/EXM-02/RES-01/ADM-01/ADM-02 passés « Terminé » avec preuve ; INF-02 marqué « non vérifiable depuis le dépôt »). **Incertitudes signalées dans les docs** plutôt qu'inventées. | `@igris` | `deepseek-v4.1-flash` | `PROGRESS.md`, `analysis_fsa_status.md`, `BACKLOG.md` | — | ✅ |
| **T11** | **Décisions bloquantes (#159)** : les recommandations de `docs/decisions-bloquantes.md` attendent une **validation humaine** (checklist §4 non cochée) — gèle le dégraissage #87. | **HUMAIN (toi)** | — | `docs/decisions-bloquantes.md` | — | ⬜ |

### 🟦 VAGUE 4 — Sortie contrôlée — T12 ✅ · T13 ✅ · **T14 en attente de ton feu vert**

| # | Tâche | Agent(s) | Modèle | Fichiers | Bloque | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| **T12** | **Gate final** — **FAIT** sur base fraîche : volume E2E détruit (`docker volume rm attestations-fsa_postgres_e2e_data`, **volume dev `attestations-fsa_postgres_data` épargné et vérifié PRESENT**) → `pnpm e2e:setup` **exit 0** (volume recréé, migrations appliquées, seed exécuté) → `pnpm test:e2e` **8/8 en 6,9 min** ; `npx tsc --noEmit` **0** ; `npx eslint .` **0 problème** (après ajout de `coverage/` et `.kilo/` aux ignores) ; `npx vitest run --coverage` **942/942** avec ratchet `59/53/63/60` **exit 0**. | `@eurinhash` | `deepseek-v4.1-flash` | — | T1–T10 | ✅ |
| **T13** | **Revue qualité & sécurité** du diff — **FAITE** (2 agents lecture seule, en parallèle). **Sécurité** : le diff **n'introduit aucune vulnérabilité** (7 points sains vérifiés : `permissions: contents: read`, aucune interpolation `${{ }}` dans les `run:`, `health-cmd` correct, garde-fou `e2e/setup/env.ts`, exclusions non masquantes, tests sans fuite) ; **1 BLOQUANT pré-existant hors diff** : `prisma/seed.ts` a un mot de passe admin en dur (`AdminFSA1452.`) **journalisé en clair** et sans garde `NODE_ENV` → **décision humaine** ; 3 durcissements appliqués (port E2E en `127.0.0.1`, `needs: [quality, test]`, commentaire CI faux corrigé), 1 suggéré (épingler les `actions` à un SHA). **Qualité** : **0 bloquant**, tests réels importent les handlers (pas de faux vert) ; **7 corrections appliquées** (docs sur les chiffres, `README.md` seuils/CI, script `e2e` dupliqué, indentation, 2 fautes `test.yml`, titre guide). | `@igris` ×2 | `deepseek-v4.1-flash` | — | T12 | ✅ |
| **T14** | **Branche + commits + PR** (Conventional Commits). **Sur ton feu vert uniquement** — en attente. | `@igris` | `deepseek-v4.1-flash` | — | T13 | 🟨 **attends ton accord** |

---

## 3. Definition of Done — « cœur métier 100 % »

- [x] `tsc --noEmit` et `eslint .` sont des **jobs bloquants de la CI** (job `quality`, et `e2e` déclare `needs: quality`).
- [ ] Le **job E2E Playwright** tourne en CI et est **vert** sur `main`.
  _Écrit + YAML validé + chaque étape prouvée localement ; l'exécution sur runner
  GitHub reste à confirmer au premier push (services + `--with-deps` = Linux only)._
- [x] L'E2E est **reproductible en 3 commandes** : `pnpm e2e:setup` puis `pnpm test:e2e` — prouvé **sans aucune variable d'env** (8/8).
- [x] `pnpm db:seed` **fonctionne** (Windows inclus) — il ne manque que la base dev : `docker compose -f compose.local.yml up -d postgres`.
- [x] `proxy.ts` et les routes cœur listées en T5–T7 **ne sont plus à 0 %**, ratchet relevé (T8).
  (`proxy.ts` 100 % · 10 routes T5 entre 87,5 et 100 % · `notifications` 100 % ·
  `email` 85,26 % · scans 91,17 % et 86,13 % · ratchet `59/53/63/60`.)
- [x] Le journal (§5) contient, pour chaque tâche, **la commande et sa sortie**.

---

## 4. Vagues d'exécution (pour aller vite)

```
V1  ─┬─ T1  (CI)                    ┐
     └─ T3  (E2E infra + seed)      ┘ en parallèle, fichiers disjoints
V2  ─┬─ T4  T5  T6  T7              ┐ en parallèle (fichiers de test distincts)
     └─ T8  (ratchet)               ┘ séquentiel, après T4–T7
V3  ─┬─ T9  (hygiène)               ┐
     └─ T10 (docs)                  ┘ parallèle    · T11 = toi
V4  ── T12 → T13 → T14              séquentiel, sur feu vert
```

---

## 5. Journal d'exécution (à tenir à jour — preuves brutes)

| Date | Tâche | Agent | Commande exécutée | Sortie (résumé factuel) |
| --- | --- | --- | --- | --- |
| 2026-09-22 | Point de situation | `@eurinhash` | `tsc` / `eslint` / `vitest` / `playwright` | 0 err · 0 err · 778/778 · **8/8 E2E** · couverture 54,79 % |
| 2026-09-22 | **T1** | `@eurinhash` | `python -c "yaml.safe_load(...)"` · `npx tsc --noEmit` · `npx eslint .` · `pnpm install --frozen-lockfile` | YAML OK (jobs `quality`,`test`,`e2e` ; `e2e.needs=quality` ; service `postgres` ; `E2E_DATABASE_URL` correct) · tsc 0 · eslint 0 · install 0 (lockfile intact). **⚠️ Non exécuté sur runner GitHub** (services + `--with-deps` = Linux only). |
| 2026-09-22 | **T3** | `@eurinhash` | `docker compose -f compose.local.yml config` · `pnpm e2e:setup` · `pnpm db:seed` · `pnpm e2e:seed` · `npx tsc -p tsconfig.seed.json --showConfig` · `pnpm test:e2e` | 2 services (`postgres`,`postgres-e2e`) · `module=commonjs` · chaîne setup **exit 0** · `db:seed` **éliminé du TS5023** (échoue maintenant uniquement si la base dev 5432 est absente : `PrismaClientInitializationError`) · `e2e:seed` **exit 0** (« The seed command has been executed ») · **E2E 8/8 en 3,6 min SANS aucune variable d'env** |
| 2026-09-22 | Gate post-changes | `@eurinhash` | `npx tsc --noEmit` · `npx eslint .` · `npx vitest run` | **0** · **0** · **778/778** (138 fichiers, 98 s) |
| 2026-09-22 | **T4** | `@igris` (`deepseek-v4.1-flash`) | `npx vitest run tests/proxy.test.ts` · `--coverage` · `tsc` · `eslint` | **24 tests verts** · `proxy.ts` lignes **21,05 % → 100 %** (stmts 97,77 %) · `tsc` 0 · `eslint` 0 · fichier `tests/proxy.test.ts` (183 lignes) |
| 2026-09-22 | **T5+T7** | `@igris` (`deepseek-v4.1-flash`) | fichiers créés + `npx vitest run <les 7>` | 4 fichiers créés (`claim`, `correction`, `claim-code`, `admin-scans-detail`) · **lignes : `claim` 0→100 %, `correction` 0→100 %, `claim-code` 0→100 %, `scans/[scanId]` 0→91,17 %, `scans/[id]` 13,86→86,13 %** · **restent à 0 % : `user/profile`, `user/after-signup`** |
| 2026-09-22 | **T6** | `@igris` (`deepseek-v4.1-flash`) | fichiers créés + run ciblé | 2 fichiers créés · **`lib/notifications.ts` 0→100 %** · **`lib/email.ts` 0→85,26 %** |
| 2026-09-22 | **Suite intégrale** | `@eurinhash` | `npx vitest run --coverage` | **875/875 tests, 145 fichiers, 92 s** — les 97 tests neufs sont intégrés et verts |
| 2026-09-22 | **Audit du chiffre de couverture** | `@eurinhash` | lecture de `coverage/coverage-summary.json` (script `cov4.js`) | **Le total affiché (61,13 %) était FAUSSE.** 55 fichiers `.kilo/worktrees/mysterious-stingray/**` étaient comptés **en double** (54/55 : chiffres identiques au réel, la 55e restée à la valeur d'avant-correction). Ces copies sont un sous-ensemble mieux couvert (77,54 %) : elles gonflaient le total de ~8 points. **Chiffre honnête : lines 53,25 % · statements 52,65 % · branches 48,09 % · functions 61,76 %** (119 fichiers réels). |
| 2026-09-22 | **T8** | `@eurinhash` | `npx vitest run --coverage` puis `… --coverage.thresholds.statements=99` | Suite **875/875** · total **52,65 / 48,08 / 61,75 / 53,25** · `grep kilo` = **0** (exclu) · **seuils posés 51/47/61/52, exit 0** ; preuve que le garde-fou s'applique : seuil impossible → **exit 1** + `ERROR: Coverage for statements (1.22%) does not meet global threshold (99%)` (et 52/61/47 cités pour les 3 autres) |
| 2026-09-22 | **T5b** | `@igris` | `npx vitest run <7 fichiers>` + lecture de `coverage/coverage-summary.json` | **7 fichiers créés, 67 tests verts** · les 7 routes passent de **0 %** à 87,5–100 % lignes · **bug trouvé côté test uniquement** (mock `userFindUnique` sans champ `password`), aucun bug applicatif |
| 2026-09-22 | **T10** | `@igris` | `git status --short` · `git log --diff-filter=D --name-only` · `ls` des routes · `grep` résiduel | Delta = **exactement** `PROGRESS.md`, `analysis_fsa_status.md`, `BACKLOG.md` · 4 modules supprimés = commit `960852f` (22/06) · correction/signalement/audit **prouvés existants** · `grep` des valeurs fausses (79 %, 369, 15 %…) → **exit 1 = aucune** · **eslint ignore les `.md`** (signalé, donc 0 erreur ne prouve rien sur le Markdown) |
| 2026-09-22 | **Hygiène lint** | `@eurinhash` | `npx eslint .` avant/après | Avant : **2 warnings** sur `coverage/lcov-report/*.js` (artefacts générés) → ajout de `coverage/`, `.kilo/`, `Backup/` aux `ignores` de `eslint.config.mjs` → **0 problème, sortie silencieuse** |
| 2026-09-22 | **T8 (2e relevé)** | `@eurinhash` | `npx vitest run --coverage` | **942/942, 152 fichiers** · **60,88 / 54,92 / 64,41 / 61,72 %** · seuils relevés `51/47/61/52` → **`59/53/63/60`** · **exit 0, aucun seuil franchi** |
| 2026-09-22 | **T12** | `@eurinhash` | `docker volume rm attestations-fsa_postgres_e2e_data` · `pnpm e2e:setup` · `pnpm test:e2e` · `tsc` · `eslint` · `vitest --coverage` | volume dev **PRESENT** (épargné) · setup **exit 0** sur base vierge (migrations + seed) · **E2E 8/8 en 6,9 min** · tsc **0** · eslint **0** · vitest **942/942** ratchet **exit 0** |
| 2026-09-22 | **T13a** (sécurité) | `@igris` (lecture seule) | `git diff` + `yaml.safe_load` + `grep` ciblés | **Aucune vulnérabilité introduite par le diff** · 7 points **sains** (`permissions: contents: read`, **aucune interpolation `${{ }}` dans les `run:`**, `health-cmd` guillemeté OK, garde-fou `e2e/setup/env.ts` refuse 5432, exclusions ancrées racine = pas de porte dérobée, tests sans fuite ni appel réel, `.env` non suivi) · **BLOQUANT pré-existant hors diff** : `prisma/seed.ts:69,91` mot de passe admin en dur **journalisé en clair**, aucun garde `NODE_ENV` · 3 durcissements, 1 suggestion |
| 2026-09-22 | **T13b** (qualité) | `@igris` (lecture seule) | `git diff` + lectures ciblées | **0 bloquant** · tests **réels** (import des handlers, mock uniquement des dépendances — pas de faux vert) · harnais `tests/helpers/request.ts` réutilisé dans 8/11 · `tsconfig.seed.json` jugé justifié · **7 incohérences détectées** (chiffres docs en retard, `README.md` seuils/CI faux, script `e2e` dupliqué, indentation, 2 fautes `test.yml`, titre guide) |
| 2026-09-22 | **Corrections post-revue** | `@eurinhash` | éditions ciblées + re-validation | `PROGRESS.md`/`analysis_fsa_status.md`/`docs/testing/README.md` remis à jour (**942 / 152 / 61,72 % / `59/53/63/60`**), script `e2e` dupliqué supprimé, indentation `prisma.seed`, commentaire CI faux + typo `sur5434`, titre « 3 commandes » → **2**, coquille `todo.md` · **durcissements** : port E2E `127.0.0.1:5434`, `e2e.needs: [quality, test]` |
| 2026-09-22 | **Gate final (rejoué après durcissements)** | `@eurinhash` | `JSON.parse(package.json)` · `yaml.safe_load` · `docker compose config` · `tsc` · `eslint` · `vitest --coverage` · `test:e2e` | JSON **OK** (doublon `e2e` supprimé) · YAML **OK** (`e2e.needs = [quality, test]`) · 2 services · `5432/tcp -> 127.0.0.1:5434` · tsc **0** · eslint **0** · **942/942, 60,88 / 54,92 / 64,41 / 61,72, ratchet exit 0** · **E2E 8/8 en 6,6 min, exit 0** |
| 2026-09-22 | **#230 vérifié (résolu par PR #234)** | `@eurinhash` | `gh pr view 234` · SQL camelCase sur base E2E · `npx vitest run tests/credential-account-convention.test.ts tests/scripts/credential-accounts.test.ts tests/seed-accounts.test.ts` · `npx ts-node scripts/audit-credential-accounts.ts` | PR #234 **MERGÉE** : 6 emplacements corrigés (`accountId: user.id`) + `scripts/audit-credential-accounts.ts` (214 l.) + `scripts/fix-credential-accounts.ts` (363 l.) + 2 tests anti-récidive · **base E2E : 2 comptes credential, 0 désaligné** · **tests 58/58 verts** · **audit script exit 0** (« Aucun compte credential désaligné ») · **reste : audit PROD (VPS) à exécuter par l'opérateur** avant toute réparation en production |

---

## 6. Notes d'environnement (à ne pas perdre)

- Base E2E locale laissée montée par `pnpm e2e:db:up` : conteneur
  `attestations-fsa-postgres-e2e`, port **5434**, base `attestation_fsa_e2e`,
  crédits = ceux de la base dev (`attestation_fsa_user` / `attestation_fsa_password`,
  cf. `compose.local.yml` — `e2e/setup/env.ts` **dérive** de `.env.local` et ne
  change que port et base). Arrêt sans destruction : `pnpm e2e:db:down`.
  Sur un clone vierge, tout est dans la doc : `pnpm e2e:setup` puis `pnpm test:e2e`.
- **Le CI ne fait ni types, ni lint, ni E2E** reste vrai **tant que le push du
  `test.yml` modifié n'a pas été fait** : T1 est écrit et validé, mais tant que
  ce fichier n'est pas sur `main`, un run CI vert n'est PAS une preuve métier.

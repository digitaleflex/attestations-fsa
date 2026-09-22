# 🧪 Stratégie de Tests — Attestations FSA

**Dernière mise à jour** : septembre 2026
**Public** : Développeurs
**Stack** : Vitest 4 + `@vitest/coverage-v8`

> ⚠️ Jest a été retiré (remplacé par Vitest). Voir #132.

---

## 🚀 Commandes

| Commande                 | Effet                                                |
| ------------------------ | ---------------------------------------------------- |
| `pnpm test`              | Lance la suite Vitest (mode run)                     |
| `pnpm test:watch`        | Mode watch                                           |
| `pnpm run test:coverage` | Suite + rapport de couverture + **seuils bloquants** |

La configuration unique est `vitest.config.ts` (alias `@` → racine, `globals: true`,
`environment: node`). Il n'existe **qu'un seul runner**.

```bash
pnpm install
pnpm test              # local
pnpm run test:coverage # comme en CI
```

---

## 🔁 CI

Le workflow [`.github/workflows/test.yml`](../../.github/workflows/test.yml) s'exécute
sur chaque `push` et `pull_request` avec **3 jobs** :

| Job | Contenu |
| --- | --- |
| `quality` | `npx tsc --noEmit` + `npx eslint .` — **bloquant** (l'E2E en dépend) |
| `test` | `pnpm audit --audit-level=high` (SCA) + `pnpm run test:coverage` (ratchet) |
| `e2e` | service `postgres:17-alpine` (5434 / `attestation_fsa_e2e`) → migrations → seed → `pnpm test:e2e` (Playwright) |

Une PR dont les types, le lint, les tests, la couverture ou l'E2E cassent
**échoue en CI**. `permissions: contents: read` (lecture seule).

> ⚠️ Le job `e2e` n'a **pas encore tourné sur un runner GitHub** (écrit et
> validé en local uniquement) — services conteneurs et `--with-deps` = Linux.

---

## 📊 Couverture & seuils

La couverture est mesurée sur `lib/**`, `app/api/**` et `proxy.ts`
(les fichiers non testés apparaissent à 0 %).

Seuils **ratchet** (plancher anti-régression) dans `vitest.config.ts` :

| Métrique   | Plancher actuel | Mesuré le 2026-09-22 | Cible à terme |
| ---------- | --------------- | -------------------- | ------------- |
| Statements | 59 %            | 60,88 %              | ≥ 90 % (cœur) |
| Branches   | 53 %            | 54,92 %              | ≥ 90 % (cœur) |
| Functions  | 63 %            | 64,41 %              | ≥ 90 % (cœur) |
| Lines      | 60 %            | 61,72 %              | ≥ 90 % (cœur) |

> **Règle** : ne jamais _baisser_ un seuil. Les relever progressivement au fur et
> à mesure que les tests atterrissent (#66 tests d'or du cœur, puis #133–#141).
> Convention retenue : `floor(mesuré) - 1` — assez strict pour bloquer une vraie
> régression, assez large pour absorber le bruit d'environnement.
>
> **Note** : le rapport de couverture **exclut** `.kilo/**`, `Backup/**` et `tmp/**`
> (`vitest.config.ts`). Ces exclusions masquaient un biais mesuré : la copie locale
> `.kilo/worktrees/**` était comptée **en double** et gonflait le total de ~8 points.

---

## 📁 Structure

```
tests/
├── helpers/            # Helpers partagés (makeRequest, …)
├── lib/                # Tests unitaires des libs support
│   ├── api-auth.test.ts
│   ├── email-health.test.ts
│   ├── email-verified.test.ts
│   └── rate-limit.test.ts
├── api/                # Tests d'intégration API
│   ├── exams/draft.test.ts
│   ├── exams/monitoring.test.ts
│   └── signalement.test.ts
└── admin-auth.test.ts
lib/                    # Tests co-localisés
├── utils.test.ts
├── exam-draft.test.ts
└── exam-enforcement.test.ts
```

Emplacement : les tests d'API vivent dans `tests/`, les tests unitaires peuvent
être co-localisés (`lib/*.test.ts`).

---

## 📝 Conventions

- Fichiers : `nom-du-module.test.ts`.
- Importer explicitement Vitest : `import { describe, it, expect, vi } from "vitest";`
  (`globals: true` est activé, mais l'import est préféré pour la lisibilité).
- Décrire en français : `describe('getAdminUser', () => { it('retourne null si non admin', ...) })`.
- **Mocker la DB** (`vi.mock('@/lib/prisma', …)`) — pas de Postgres réel en test unitaire.
- Réutiliser `tests/helpers/*` plutôt que dupliquer les faux objets de requête.

---

## 📚 Guides associés

- [Tests unitaires](./guide-tests-unitaires.md)
- [Tests d'intégration API](./guide-tests-integration-api.md)
- [Tests E2E](./guide-tests-e2e.md)
- [Mocks & fixtures](./guide-mocks-fixtures.md)

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
sur chaque `push` et `pull_request` :

```
pnpm install --frozen-lockfile
pnpm run test:coverage   # échoue sous les seuils
```

Une PR dont les tests cassent (ou font régresser la couverture) **échoue en CI**.

---

## 📊 Couverture & seuils

La couverture est mesurée sur `lib/**`, `app/api/**` et `proxy.ts`
(les fichiers non testés apparaissent à 0 %).

Seuils **ratchet** (plancher anti-régression) dans `vitest.config.ts` :

| Métrique   | Plancher actuel | Cible à terme |
| ---------- | --------------- | ------------- |
| Statements | 6 %             | ≥ 90 % (cœur) |
| Branches   | 6 %             | ≥ 90 % (cœur) |
| Functions  | 9 %             | ≥ 90 % (cœur) |
| Lines      | 6 %             | ≥ 90 % (cœur) |

> **Règle** : ne jamais _baisser_ un seuil. Les relever progressivement au fur et
> à mesure que les tests atterrissent (#66 tests d'or du cœur, puis #133–#141).

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

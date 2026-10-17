# Triage des issues — 2026-10-17

> Source : état réel vérifié sur GitHub (`gh issue list`). **39 issues ouvertes**,
> 216 fermées. Toutes portent maintenant un label de priorité.

## Répartition

| Priorité | Nombre | Nature |
|:--- | ---: | :--- |
| 🔴 `p0` | **5** | Bloquent la production ou la conformité |
| 🟡 `p1` | **15** | Importants, non bloquants |
| 🟢 `p2` | **21** | Backlog produit et contenu |

## 🔴 P0 — 5 issues

| Issue | Objet | Blocage |
| :--- | :--- | :--- |
| `#148` | EPIC prérequis production | englobe #156 et #153 |
| **`#156`** | Staging + migrations/rollback | **seul P0 infra restant** — arbitrage requis |
| **`#153`** | Conformité RGPD / APDP | chiffrement au repos — arbitrage requis |
| `#323` | Plan maître de fermeture des risques | coordination |
| `#347` | Conformité des contenus légaux | promesses produit vs réalité |

## 🟡 P1 — 15 issues

**Qualité / tests** (EPIC `#131`) : `#131` · `#138` T7 · `#140` T9 · `#141` T10
**Correctifs techniques** : `#322` invariants attestations · `#319` pollution catalogue · `#318` sessions abandonnées
**Production** : `#348` audit routes · `#349` SEO/perf · `#350` vue détail formation · `#351` terminologie FSA
**Socles de la vague Auth** : `#344` architecture · `#357` primitives
**Documentation** : `#297`
**E2E** : `#272` parcours stages

## 🟢 P2 — 21 issues

Backlog UX/Design de la campagne de refonte (`#335`–`#361`), plus `#147`
(contrat agents) et les 2 EPIC de suivi `#340` / `#360`.

## Ordre d'exécution de la vague Auth

Documenté sur `#357` et `#356` :

```
#352 (spec)
  └─ #344 (architecture)  ← socle
  └─ #357 (primitives)    ← socle
       └─ #353 #354 (écrans)
            └─ #355 #358 #359 (états)
                 └─ #356 (QA) ← blocked
```

Traiter les écrans avant les socles `#344` et `#357` revient à redessiner deux fois.

## Issues portant `needs-decision`

`#153` et `#156` sont techniquement documentées mais bloquées sur un arbitrage
produit : le chiffrement au repos exige de migrer des fichiers déjà stockés
(risque sur pièces probantes), et un rollback base automatique est plus dangereux
que le problème qu'il résout.

## Fermée pendant ce triage

`#338` — étiquetée `enhancement` alors que c'était un défaut d'honnêteté de
l'interface (le placeholder promettait une recherche par compétence). **Déjà
corrigé** dans `app/(public)/formations/FormationsClient.tsx:57-62` : la
normalisation et `f.skills` sont dans le filtre. L'incohérence avait été levée
sans que l'issue soit fermée.
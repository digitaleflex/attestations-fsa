import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    // `exclude` REMPLACE la liste par défaut de Vitest (aucune fusion
    // automatique) : sans `...configDefaults.exclude` on supprimerait
    // l'exclusion de `node_modules` et de `.git`.
    //
    // Vague 0 / item 2 : ce dépôt héberge 22 worktrees Git dans `.worktrees/`.
    // Chacun contient une copie PÉRIMÉE de `tests/`, donc `vitest run` sans
    // argument exécutait des tests qui n'appartiennent pas à la branche
    // courante. La CI est verte parce qu'elle fait un checkout propre, sans
    // worktrees — l'écart n'apparaît que sur une machine de dev. D'où 450 tests
    // en échec en local et 0 en CI, sur exactement le même commit.
    // (Un troisième motif, `.kilo/**`, avait été ajouté pour un clone local qui
    // n'existe plus — conservé ci-dessous à coût nul, par cohérence avec
    // `coverage.exclude`.)
    exclude: [
      ...configDefaults.exclude,
      ".worktrees/**",
      ".kilo/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "proxy.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "lib/prisma.ts",
        "lib/generated/**",
        // Garde à coût nul contre un éventuel clone local (`.kilo/`) : le
        // dossier N'EXISTE PLUS dans ce dépôt. Historiquement, une telle copie
        // de `lib/` entrait dans le rapport via `coverage.include` et gonflait
        // artificiellement le total (~8 points), parce qu'elle est plus petite
        // et mieux couverte que l'original. Motif conservé, récit historique
        // non : le coût est nul et la protection vaut si quelqu'un reclone un
        // jour le dépôt à côté.
        ".kilo/**",
        // Vague 0 : les 22 worktrees Git de `.worktrees/` contiennent chacun une
        // copie PÉRIMÉE de `lib/` et `app/api/`. Exclusion de défense : le
        // `include` ci-dessus est ancré à la racine (`lib/**`, pas `**/lib/**`)
        // et `test.exclude` (lignes 22-27) empêche de charger ces worktrees, donc
        // AUCUN fichier worktree n'entre dans le rapport AUJOURD'HUI — mesuré :
        // 124 fichiers au rapport, 0 sous `.worktrees/`, chiffres
        // identiques à la seconde décimale avec ou sans cette ligne.
        //
        //Pourquoi la garde reste utile : `BaseCoverageProvider.isIncluded()`
        // teste le chemin ABSOLU avec `picomatch(..., { contains: true })`, donc
        // un motif `lib/**` matche `.worktrees/<wt>/lib/x.ts` par sous-chaîne.
        // Aujourd'hui ça ne peut pas se déclencher, car les fichiers non testés
        // sont énumérés par `getUntestedFilesByRoot()` via `tinyglobby({ cwd: root })`
        // qui, lui, ancre réellement le motif à la racine. C'est ce maillon —
        // pas `isIncluded` — qui tient aujourd'hui. Relâcher `include` vers
        // `**/lib/**`, monter un projet imbriqué en `root`, ou réintroduire des
        // tests worktree ferait réapparaître les doublons. Coût nul, garde utile.
        ".worktrees/**",
        "Backup/**",
        "tmp/**",
      ],
      // Ratchet anti-régression : seuils plancher.
      //
      // Mesure de référence, relevée sur ce commit (HORS worktrees, cf.
      // `exclude` ci-dessus) :
      //   statements 74,07 % · branches 70,54 % · functions 79,70 % · lines 75,16 %
      // (historique : 10/9/12/10 au départ → 51/47/61/52 à 53,25 % de lignes au
      //  22/09, releu 60,88 / 54,92 / 64,41 / 61,72 % à cette date — chiffres
      //  périmés depuis, le dépôt a gagné une quinzaine de points de couverture
      //  sur les vagues suivantes.)
      //
      // RECALIBRAGE (précédent : 59/53/63/60). Ces seuils-là laissaient passer
      // une régression de ~15 points sans broncher : ils ne protégeaient plus
      // rien, ils ne faisaient que constater qu'un test avait tourné. Ils sont
      // ramenés à ~2 points sous la mesure réelle, soit 72/68/77/73 :
      //   - JAMAIS au-dessus de la mesure (un seuil supérieur fait échouer la CI
      //     au premier run — pire que le laxisme d'avant) ;
      //   - la marge de ~2 points absorbe la variation d'un environnement à
      //     l'autre : CI Linux en checkout propre vs machine de dev avec ses
      //     22 worktrees, exécution parallèle, version de Node et deltas du
      //     provider v8. En dessous de 2 points, un simple décalage d'exécution
      //     ferait échouer la CI sur un commit sain ; au-dessus de 5, le ratchet
      //     redevenirait décoratif.
      // Le relevé est documenté ci-dessus pour que la prochaine calibration
      // reparte du bon chiffre, et non d'un seuil périmé.
      //
      // Le garde-fou est PRUVÉ actif : un seuil impossible fait échouer le run
      // (`exit 1` + `ERROR: Coverage for … does not meet global threshold`).
      //
      // Objectifs à viser (cf. commentaires historiques #66 / #133-#141) :
      // cœur >= 90 %, API >= 70 %.
      // Ne jamais baisser ces valeurs.
      thresholds: {
        statements: 72,
        branches: 68,
        functions: 77,
        lines: 73,
      },
    },
  },
});

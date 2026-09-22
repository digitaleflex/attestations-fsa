import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "proxy.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "lib/prisma.ts",
        "lib/generated/**",
        // #T9 — Copie locale du repo (worktree kilo). `coverage.include` la
        // catch aussi : 55 fichiers DONNÉES EN DOUBLE, tous des doublons purs
        // (54/55 ont exactement les mêmes lignes que leur homologue réel, la
        // 55e étant restée à la valeur d'avant-correction). Cette copie est un
        // sous-ensemble bien couvert (77,54 %) alors que le réel est à
        // 53,25 % : elle gonflait artificiellement le total de ~8 points
        // (61,14 % affiché vs 53,25 % réel). Exclure, sinon les seuils ci-
        // dessous seraient calés sur un chiffre faux — et un clone propre,
        // sans `.kilo/`, ferait échouer la CI.
        ".kilo/**",
        "Backup/**",
        "tmp/**",
      ],
      // Ratchet anti-régression : seuils plancher.
      //
      // Mesuré le 2026-09-22, APRÈS la vague T4-T7 (942 tests / 152 fichiers),
      // HORS doublons `.kilo` (voir exclude ci-dessus) :
      //   statements 60,88 % · branches 54,92 % · functions 64,41 % · lines 61,72 %
      // (historique : 10/9/12/10 au départ → 51/47/61/52 à 53,25 % de lignes,
      //  relevé une 2e fois quand T5b a fait passer les 7 dernières routes de 0 %.)
      //
      // Seuils fixés à `floor(mesuré) - 1` : une marge d'environ 1 point
      // absorbe le bruit d'environnement (CI Linux sans `.kilo/`, delta v8)
      // sans laisser passer une vraie régression. Valeurs mesurées documentées
      // ci-dessus pour que le relevé suivant parte du bon chiffre.
      //
      // Le garde-fou est Prouvé actif : un seuil impossible fait échouer le run
      // (`exit 1` + `ERROR: Coverage for … does not meet global threshold`).
      //
      // Objectifs à viser (cf. commentaires historiques #66 / #133-#141) :
      // cœur >= 90 %, API >= 70 %.
      // Ne jamais baisser ces valeurs.
      thresholds: {
        statements: 59,
        branches: 53,
        functions: 63,
        lines: 60,
      },
    },
  },
});

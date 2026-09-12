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
      ],
      // Ratchet anti-régression : seuils plancher au niveau de couverture
      // actuel. Ils DOIVENT être relevés progressivement vers les cibles
      // cœur >= 90 % et API >= 70 % au fur et à mesure que les tests du
      // filet de sécurité atterrissent (cf. #66 puis #133-#141).
      // Ne jamais baisser ces valeurs.
      thresholds: {
        statements: 10,
        branches: 9,
        functions: 12,
        lines: 10,
      },
    },
  },
});

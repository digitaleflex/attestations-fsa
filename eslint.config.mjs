import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { 
    ignores: [
      ".next/",
      ".next-e2e/",
      "node_modules/",
      "tmp/",
      "dist/",
      "public/",
      // Rapport de couverture : fichiers GÉNÉRÉS (sinon le gate linter du
      // bruit : 2 warnings sur coverage/lcov-report/*.js après un run --coverage).
      "coverage/",
      // Artefacts Playwright (générés, déjà gitignorés) : sans ces ignores,
      // `eslint .` remonte ~3 300 erreurs sur playwright-report/trace/assets
      // (bundles minifiés) et le gate `pnpm verify` casse en local.
      "playwright-report/",
      "test-results/",
      "playwright/.cache/",
      // Copies locales du repo (worktrees) + sauvegardes : code dupliqué,
      // déjà ignoré par git via .git/info/exclude. Linter une copie gaspille
      // du temps et peut remonter des faux positifs. Sans ".worktrees/**",
      // `eslint .` parcourt les 22 worktrees et n'aboutit jamais en local,
      // alors que la CI est verte (les worktrees n'y sont pas).
      ".worktrees/",
      ".kilo/",
      "Backup/",
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  { 
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], 
    languageOptions: { 
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
        react: { version: "detect" }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'react/no-unknown-property': ['error', { ignore: ['jsx', 'global'] }],
      'react/prop-types': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/typedef': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      'passing-generics-to-types': 'off',
      'ts-object-type': 'off',
      'basic-types': 'off',
      'optional-object-property': 'off',
      'typing-function-parameters': 'off',
      'any-type': 'off',
      'as-assertion': 'off',
      'union-type': 'off',
      'null-keyword': 'off',
      'undefined-keyword': 'off',
      'function-return-type': 'off',
      'interface-declaration': 'off',
      'literal-type': 'off',
      'variable-type-annotation': 'off',
      'array-type': 'off',
      'type-predicate': 'off',
      'in-operator-narrowing': 'off',
      '@typescript-eslint/passing-generics-to-types': 'off',
      '@typescript-eslint/ts-object-type': 'off',
      '@typescript-eslint/basic-types': 'off',
    },
  },
  // Garde-fou a11y du DESIGN SYSTEM (#P2).
  //
  // `jsx-a11y` est déjà en devDependencies mais n'était jamais branché : les
  // régressions d'accessibilité n'étaient donc attrapées par AUCUN lint, seulement
  // à la relecture. On l'active sur le périmètre dont cette vague a la charge —
  // `components/ui/**` et les coquilles (layouts) qui définissent les points
  // d'anneau (`main`, navigation) — et PAS sur `app/admin/**` ni sur les flux
  // examen : y brancher le plugin ferait échouer `pnpm lint` sur des violations
  // préexistantes, hors périmètre de cette vague.
  //
  // `no-autofocus` est laissé actif : un `autoFocus` au montage vole le focus
  // avant que l'utilisateur n'ait choisi où il est.
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/no-autofocus": "error",
    },
  },
  {
    files: [
      "app/(public)/layout.tsx",
      "app/(user)/layout.tsx",
      "components/PublicHeader.tsx",
    ],
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/no-autofocus": "error",
    },
  },
  // Regles des hooks React — plugin installe mais jusqu'ici JAMAIS branche :
  // les hooks n'etaient donc verifies par aucun lint, seulement a la relecture.
  //
  // Deux niveaux de severite, volontairement distincts :
  //
  // 1. `rules-of-hooks` en ERROR — un hook appele conditionnellement, ou dans
  //    une boucle, viole l'ordre des hooks et provoque des crashs React
  //    imprevisibles (et des violations de hooks en mode strict). C'est la
  //    classe de bug qui fait crasher la production ; elle doit bloquer.
  //    Verifie a l'activation : ZERO violation existante.
  //
  // 2. `exhaustive-deps` en WARN — dependances manquantes dans un tableau de
  //    deps. Sur ce depot, les 6 avertissements restants portent sur des
  //    effets de SYNCHRONISATION (lecture de searchParams, fetch au montage) :
  //    y ajouter la dependance reboucle l'effet et casse le comportement.
  //    Exemple reel : `app/admin/attestations/page.tsx` synchronise les
  //    filtres avec l'URL ; dependre de `search` le ferait reinitialiser le
  //    champ de recherche a chaque frappe. Le couplage est donc DELIBERE.
  //
  //    Reste en `warn` : elle bloque le gate (`eslint .` ne sort en erreur que
  //    sur les erreurs, pas les avertissements), donc elle alerte sans casser
  //    la CI, et elle documente les 6 cas au lieu de les laisser passer
  //    inaperces.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  }
);

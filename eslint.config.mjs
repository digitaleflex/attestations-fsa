import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default tseslint.config(
  { 
    ignores: [".next/", "node_modules/", "tmp/", "dist/", "public/"] 
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
  }
);

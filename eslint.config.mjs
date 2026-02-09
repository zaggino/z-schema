import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effect imports.
            ['^\\u0000'],
            // Node.js builtins prefixed with `node:`.
            ['^node:'],
            // Packages.
            // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
            ['^@?\\w'],
            // Absolute imports and other imports such as Vue-style `@/foo`.
            // Anything not matched in another group.
            ['^'],
            // Relative imports.
            // Anything that starts with a dot and doesn't end with .json
            ['^(?!.*\\.json$)\\.'],
            // Anything that starts with a dot
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/rules/no-unused-vars.ts#L220-L288
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          // destructuredArrayIgnorePattern: '^_',
          // vars: 'all',
          // varsIgnorePattern: '^_',
          // ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    extends: ['markdown/recommended'],
    rules: {
      'markdown/no-missing-label-refs': 'off',
      'markdown/no-multiple-h1': 'off',
    },
  },
  {
    files: ['test/**'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-conditional-expect': 'off',
      'vitest/no-standalone-expect': 'off',
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
  },
  globalIgnores([
    '.env*',
    '.github/',
    '*.min.js',
    'benchmark/',
    'build/',
    'cjs/',
    'coverage/',
    'dist/',
    'json-schema-spec/',
    'node_modules/',
    'package-lock.json',
    'specs/',
    'test/dist/',
    'test/public/json-schema-test-suite/',
    'umd/',
  ]),
]);

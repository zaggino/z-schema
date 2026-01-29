import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import vitest from '@vitest/eslint-plugin';

export default defineConfig([
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
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'json/no-empty-keys': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'prefer-const': 'off',
      'prefer-rest-params': 'off',
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
    '.github/',
    'benchmark/',
    'dist/',
    'json-schema/',
    'test/jsonSchemaTestSuite/',
    'specs/',
    'package-lock.json',
  ]),
]);

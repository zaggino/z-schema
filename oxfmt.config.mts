import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  ...ultracite,
  // Preserve the project's existing formatting style (previously .oxfmtrc.json).
  printWidth: 120,
  singleQuote: true,
  trailingComma: 'es5',
  semi: true,
  sortPackageJson: true,
  sortImports: {
    groups: ['type', 'builtin', 'external', ['internal', 'subpath'], ['parent', 'sibling', 'index'], 'unknown'],
  },
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    '.DS_Store',
    '.idea/',
    '.vscode/',
    'build/',
    'CHANGELOG.md',
    'cjs/',
    'coverage/',
    'dist/',
    'json-schema-spec/',
    'node_modules/',
    'package-lock.json',
    'pnpm-lock.yaml',
    'specs/',
    'test/public/json-schema-test-suite/',
    'umd/',
    'yarn.lock',
  ],
});

import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  ...ultracite,
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
    // Project-specific paths not covered by .gitignore (which oxfmt honors by
    // default) nor by the ultracite preset: a release-managed changelog, the
    // git submodule, and vendored test fixtures.
    'CHANGELOG.md',
    'json-schema-spec/',
    'test/public/json-schema-test-suite/',
  ],
});

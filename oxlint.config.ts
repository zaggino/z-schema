import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';

export default defineConfig({
  extends: [core],
  // Type-aware linting (requires the oxlint-tsgolint engine).
  options: {
    typeAware: true,
  },
  plugins: ['typescript', 'vitest'],
  env: {
    browser: true,
    node: true,
  },
  rules: {
    // ── Intentional project rules on top of ultracite defaults
    'class-methods-use-this': 'off',
    complexity: 'off',
    eqeqeq: 'off',
    'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    'max-classes-per-file': 'off',
    'no-eq-null': 'off',
    'no-inline-comments': 'off',
    'no-param-reassign': 'off',
    'no-plusplus': 'off',
    'no-unused-vars': [
      'error',
      { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' },
    ],
    'no-warning-comments': 'off',
    'promise/avoid-new': 'off',
    'require-unicode-regexp': 'off',
    'sort-keys': 'off',
    'typescript/array-type': ['error', { default: 'array-simple' }],
    'typescript/consistent-return': 'off',
    'typescript/no-dynamic-delete': 'off',
    'typescript/no-explicit-any': 'off',
    'typescript/no-non-null-assertion': 'off',
    'typescript/prefer-nullish-coalescing': 'off',
    'typescript/promise-function-async': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-thenable': 'off',
    'unicorn/prefer-node-protocol': 'off',

    // ── Intentionally kept off for performance (NOT in the TODO backlog) ──
    // Excluded from the lint re-enable effort on performance grounds: the
    // "fixed" form is measurably slower than the construct it replaces.

    // Object destructuring only. Array destructuring goes through the iterator
    // protocol (slower than indexed access) which the validation hot paths rely
    // on, so it is intentionally not enforced here.
    'prefer-destructuring': ['error', { array: false, object: true }],

    // Spread over .concat()/.slice() allocates via the iterator protocol —
    // slower than Array#concat/#slice in hot paths (report.ts, schema-compiler.ts).
    'unicorn/prefer-spread': 'off',

    // for…of adds iterator-protocol overhead vs indexed access in validation
    // hot paths (validation/array.ts items loop, report.ts path building).
    'typescript/prefer-for-of': 'off',

    // charCodeAt is the correct, faster primitive for ASCII range checks and
    // manual surrogate-pair scanning (format-validators.ts percent-encoding,
    // utils/unicode.ts length). codePointAt does extra surrogate work we don't
    // need on these hot per-character paths.
    'unicorn/prefer-code-point': 'off',

    // Parameterless Array#sort over string keys uses native lexicographic
    // comparison — faster than, and identical to, a JS comparator on the clone
    // hot path (utils/clone.ts shallowClone/deepClone key ordering). Enabling the
    // rule would force a per-comparison JS callback for no functional gain.
    'unicorn/no-array-sort': 'off',

    // ── TODO: rules from the ultracite preset currently reporting errors ──
    // Disabled to reach a clean baseline; re-evaluate and re-enable incrementally.

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 105
    // complexity: dangerous
    // Member access on `any`-typed values is common in schema traversal code; fixing requires narrowing types or adding casts throughout.
    // type: type-safety
    // Disallows accessing properties on values typed as `any`, which bypasses TypeScript's type checking.
    'typescript/no-unsafe-member-access': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 81
    // complexity: moderate
    // `this` is used inside functions that are exported; restructuring requires converting them to methods or passing context explicitly.
    // type: bug-prevention
    // Disallows `this` inside exported standalone functions where the `this` context is unpredictable.
    'oxc/no-this-in-exported-function': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 32
    // complexity: dangerous
    // Calls are made on `any`-typed values in schema processing; fixing requires narrowing types or explicit casts.
    // type: type-safety
    // Disallows calling values typed as `any`, which bypasses TypeScript's call-signature checking.
    'typescript/no-unsafe-call': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 27
    // complexity: moderate
    // Callbacks are passed where `async`/`await` equivalents exist; refactoring requires verifying async compatibility of each call site.
    // type: best-practice
    // Prefers `async`/`await` over callback-based APIs when a promise-based alternative is available.
    'promise/prefer-await-to-callbacks': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 26
    // complexity: moderate
    // Identifiers are referenced before their declaration; hoisting or reordering declarations is required per site.
    // type: bug-prevention
    // Disallows references to variables, functions, or classes before they are defined in the source.
    'no-use-before-define': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 23
    // complexity: dangerous
    // Most sites assert values to `any` or narrow types; tightening requires real upstream typing work.
    // type: type-safety
    // Flags type assertions that bypass the type checker (notably assertions to/from `any`), which can mask runtime errors.
    'typescript/no-unsafe-type-assertion': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 13
    // complexity: dangerous
    // Arguments typed as `any` are passed into typed parameters; fixing requires narrowing the source types or adding explicit casts.
    // type: type-safety
    // Disallows passing `any`-typed values as arguments to typed function parameters.
    'typescript/no-unsafe-argument': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 11
    // complexity: dangerous
    // Values typed as `any` are assigned to typed variables; fixing requires narrowing the source types throughout the codebase.
    // type: type-safety
    // Disallows assigning `any`-typed values to typed variables or properties.
    'typescript/no-unsafe-assignment': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: dangerous
    // Functions return `any`-typed values where a typed return is expected; fixing requires narrowing the returned types.
    // type: type-safety
    // Disallows returning `any`-typed values from functions with non-`any` return type annotations.
    'typescript/no-unsafe-return': 'off',
  },
  overrides: [
    {
      files: ['test/**'],
      rules: {
        'vitest/no-conditional-expect': 'off',
        'vitest/no-standalone-expect': 'off',
      },
    },
  ],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    '.github/',
    'benchmark/',
    'cjs/',
    'json-schema-spec/',
    'specs/',
    'test/public/json-schema-test-suite/',
    'umd/',
  ],
});

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
    'require-unicode-regexp': 'off',
    'sort-keys': 'off',
    'typescript/array-type': ['error', { default: 'array-simple' }],
    'typescript/consistent-return': 'off',
    'typescript/no-dynamic-delete': 'off',
    'typescript/no-explicit-any': 'off',
    'typescript/no-non-null-assertion': 'off',
    'unicorn/no-array-for-each': 'off',
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
    // occurrences in codebase: 73
    // complexity: easy
    // Source files do not follow the kebab-case filename convention enforced by this rule.
    // type: style
    // Requires filenames to follow a specified case convention (e.g., kebab-case).
    'unicorn/filename-case': 'off',

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
    // occurrences in codebase: 18
    // complexity: dangerous
    // Expressions are used in boolean positions without explicit comparison; fixing requires auditing each site for nullable/falsy semantics.
    // type: type-safety
    // Disallows loosely-typed truthy/falsy checks, requiring explicit boolean comparisons or type guards.
    'typescript/strict-boolean-expressions': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 13
    // complexity: moderate
    // Nullable values are combined with `||` where `??` is semantically more correct; each site needs auditing for falsy vs. nullish intent.
    // type: type-safety
    // Prefers the nullish coalescing operator (`??`) over `||` when the left-hand side may be `null` or `undefined`.
    'typescript/prefer-nullish-coalescing': 'off',

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
    // occurrences in codebase: 8
    // complexity: moderate
    // `new Promise()` constructors are used in places where an existing promise-returning API could be used directly.
    // type: best-practice
    // Disallows explicit `new Promise()` construction when a simpler promise-returning API is available.
    'promise/avoid-new': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: moderate
    // Functions that return a `Promise` are not marked `async`; adding `async` changes the error-handling behaviour for thrown exceptions.
    // type: best-practice
    // Requires functions that return a `Promise` to be declared with the `async` keyword.
    'typescript/promise-function-async': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: dangerous
    // Functions return `any`-typed values where a typed return is expected; fixing requires narrowing the returned types.
    // type: type-safety
    // Disallows returning `any`-typed values from functions with non-`any` return type annotations.
    'typescript/no-unsafe-return': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // An object has a `.then()` method which makes it thenable, potentially causing confusion with promises in `await` expressions.
    // type: bug-prevention
    // Disallows objects that define a `.then()` method in non-promise contexts, as they are mistakenly treated as thenables.
    'unicorn/no-thenable': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: moderate
    // A class method does not reference `this` and could be a static method or standalone function; refactoring may change call-site API.
    // type: maintainability
    // Requires class methods that do not use `this` to be declared as `static`.
    'class-methods-use-this': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 4
    // complexity: dangerous
    // The validator intentionally rejects promises with structured validation reports, not Error instances; changing this is an API change.
    // type: bug-prevention
    // Requires Promise rejection reasons to be Error objects.
    'typescript/prefer-promise-reject-errors': 'off',
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

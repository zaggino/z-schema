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
    'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    'no-inline-comments': 'off',
    'no-plusplus': 'off',
    'no-unused-vars': [
      'error',
      { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' },
    ],
    'no-warning-comments': 'off',
    'require-unicode-regexp': 'off',
    'sort-keys': 'off',
    'typescript/array-type': ['error', { default: 'array-simple' }],
    'typescript/consistent-type-imports': 'error',
    'typescript/no-explicit-any': 'off',
    'typescript/no-non-null-assertion': 'off',
    'unicorn/prefer-node-protocol': 'off',

    // ── Intentionally kept off for performance (NOT in the TODO backlog) ──
    // Excluded from the lint re-enable effort on performance grounds: the
    // "fixed" form is measurably slower than the construct it replaces.

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

    // ── TODO: rules from the ultracite preset currently reporting errors ──
    // Disabled to reach a clean baseline; re-evaluate and re-enable incrementally.

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 171
    // complexity: trivial
    // Many function expressions lack names; adding names aids stack traces but is purely mechanical.
    // type: maintainability
    // Requires function expressions to have a name (aids debugging via named stack frames).
    'func-names': 'off',

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
    // occurrences in codebase: 76
    // complexity: trivial
    // Anonymous function expressions are passed as callbacks; converting to arrow functions is mechanical.
    // type: style
    // Requires arrow functions in callback positions instead of traditional function expressions.
    'prefer-arrow-callback': 'off',

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
    // occurrences in codebase: 21
    // complexity: easy
    // Destructuring is not used where it could simplify property extraction from objects/arrays.
    // type: style
    // Requires destructuring assignment instead of accessing individual properties via member expressions.
    'prefer-destructuring': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 18
    // complexity: dangerous
    // Expressions are used in boolean positions without explicit comparison; fixing requires auditing each site for nullable/falsy semantics.
    // type: type-safety
    // Disallows loosely-typed truthy/falsy checks, requiring explicit boolean comparisons or type guards.
    'typescript/strict-boolean-expressions': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 17
    // complexity: easy
    // Empty function bodies exist as stubs or no-op implementations; adding a comment or explicit body is required per rule.
    // type: best-practice
    // Disallows empty function bodies unless explicitly opted out with a comment explaining the intent.
    'no-empty-function': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 15
    // complexity: moderate
    // Function parameters are reassigned in several places; refactoring requires introducing local variables or restructuring logic.
    // type: bug-prevention
    // Disallows reassignment of function parameters, which can cause unexpected mutation of caller-supplied objects.
    'no-param-reassign': 'off',

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
    // occurrences in codebase: 13
    // complexity: hard
    // Functions exceed the cyclomatic complexity threshold; reducing complexity requires logic decomposition and refactoring.
    // type: maintainability
    // Enforces a maximum cyclomatic complexity threshold per function to encourage simpler, more testable code.
    complexity: 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 12
    // complexity: easy
    // `if/else` blocks are written where a negated condition version is cleaner; mechanical inversion needed.
    // type: style
    // Disallows negated conditions in `if/else` when swapping the branches would be clearer.
    'unicorn/no-negated-condition': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 12
    // complexity: easy
    // `.forEach()` is used on arrays where a `for...of` loop is preferred for clarity and early-exit capability.
    // type: style
    // Disallows `Array.prototype.forEach` in favour of `for...of` loops.
    'unicorn/no-array-for-each': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 12
    // complexity: dangerous
    // `async` functions contain no `await` expression; removing `async` or adding `await` may affect error-handling semantics.
    // type: bug-prevention
    // Disallows `async` functions that contain no `await` expression, which is usually unintentional.
    'require-await': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 12
    // complexity: easy
    // `if/else` with a negated test is used where a positive-condition version would be more readable.
    // type: style
    // Disallows negated conditions in `if/else` statements when reordering branches would remove the negation.
    'no-negated-condition': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 11
    // complexity: moderate
    // Functions defined inside other functions could be moved to an outer scope; refactoring requires verifying closure dependencies.
    // type: maintainability
    // Flags functions that can be moved to a higher scope, reducing closure overhead and improving readability.
    'unicorn/consistent-function-scoping': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 11
    // complexity: dangerous
    // Values typed as `any` are assigned to typed variables; fixing requires narrowing the source types throughout the codebase.
    // type: type-safety
    // Disallows assigning `any`-typed values to typed variables or properties.
    'typescript/no-unsafe-assignment': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 10
    // complexity: easy
    // `== null` comparisons are used where `=== null || === undefined` (or `??`) is preferred.
    // type: best-practice
    // Disallows `== null` comparisons, requiring strict equality checks for `null` and `undefined`.
    'no-eq-null': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 10
    // complexity: easy
    // Loose equality (`==`) is used in some comparisons; replacing with strict equality (`===`) is mostly mechanical.
    // type: bug-prevention
    // Requires strict equality operators (`===`/`!==`) instead of loose equality (`==`/`!=`).
    eqeqeq: 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 9
    // complexity: moderate
    // Variable names shadow outer-scope variables; renaming requires confirming no semantic collision exists.
    // type: bug-prevention
    // Disallows variable declarations that shadow variables declared in outer scopes.
    'no-shadow': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 8
    // complexity: moderate
    // `Array.prototype.sort()` is called without a comparator, which has locale-dependent behaviour; each call site needs an explicit comparator.
    // type: bug-prevention
    // Disallows calling `Array.prototype.sort()` without a comparator function to avoid non-deterministic sort order.
    'unicorn/no-array-sort': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 8
    // complexity: moderate
    // `new Promise()` constructors are used in places where an existing promise-returning API could be used directly.
    // type: best-practice
    // Disallows explicit `new Promise()` construction when a simpler promise-returning API is available.
    'promise/avoid-new': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 4
    // complexity: dangerous
    // `delete obj[key]` is used with dynamic keys; replacing with explicit property removal or `Map` usage requires careful refactoring.
    // type: bug-prevention
    // Disallows the `delete` operator on computed/dynamic object properties, which can cause performance issues and type unsafety.
    'typescript/no-dynamic-delete': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 4
    // complexity: easy
    // Constructor bodies are empty and could be removed; each site needs verification that the parent constructor call is not needed.
    // type: style
    // Disallows constructors that do nothing beyond calling `super()` or are entirely empty.
    'no-useless-constructor': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: moderate
    // Functions that return a `Promise` are not marked `async`; adding `async` changes the error-handling behaviour for thrown exceptions.
    // type: best-practice
    // Requires functions that return a `Promise` to be declared with the `async` keyword.
    'typescript/promise-function-async': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: moderate
    // TypeScript parameter properties (shorthand constructor `private x`) are used; converting to explicit properties requires structural changes.
    // type: style
    // Disallows TypeScript parameter property syntax in constructors, requiring explicit class property declarations.
    'typescript/parameter-properties': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: dangerous
    // Functions return `any`-typed values where a typed return is expected; fixing requires narrowing the returned types.
    // type: type-safety
    // Disallows returning `any`-typed values from functions with non-`any` return type annotations.
    'typescript/no-unsafe-return': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: moderate
    // Error-first callbacks are used but the error argument is not checked before proceeding; each site requires an explicit error guard.
    // type: bug-prevention
    // Requires error-first callback parameters to be handled (checked or re-thrown) rather than silently ignored.
    'node/handle-callback-err': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: easy
    // Custom error classes throw `new Error(...)` instead of `new TypeError(...)` or another appropriate subclass.
    // type: best-practice
    // Prefers throwing type-specific `Error` subclasses (e.g., `TypeError`) over generic `Error` in error-related contexts.
    'unicorn/prefer-type-error': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // CommonJS constructs (`require`, `module.exports`) are used; migrating to ESM requires coordinated changes and build-config updates.
    // type: best-practice
    // Requires ECMAScript module syntax (`import`/`export`) instead of CommonJS (`require`/`module.exports`).
    'unicorn/prefer-module': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // An object has a `.then()` method which makes it thenable, potentially causing confusion with promises in `await` expressions.
    // type: bug-prevention
    // Disallows objects that define a `.then()` method in non-promise contexts, as they are mistakenly treated as thenables.
    'unicorn/no-thenable': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: easy
    // Two function overloads share a signature that could be merged into one using a union type.
    // type: maintainability
    // Flags function overloads that can be unified into a single signature with a union or optional parameter.
    'typescript/unified-signatures': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // Functions annotated with a `void` return type return a value in some code paths; requires auditing intent.
    // type: type-safety
    // Disallows returning a value from a function whose return type is `void`.
    'typescript/strict-void-return': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // `return await promise` is used inside `async` functions where `return promise` would be equivalent; however changing it can alter stack trace and try/catch semantics.
    // type: best-practice
    // Requires or disallows `return await` inside `async` functions; the preferred form depends on stack-trace and error-propagation needs.
    'typescript/return-await': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // A `void`-typed expression is used in a non-void context (e.g., passed as a value); restructuring is required to avoid the confusion.
    // type: type-safety
    // Disallows using expressions of type `void` in positions where a non-void value is expected.
    'typescript/no-confusing-void-expression': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: trivial
    // Promise executor or parameter names do not follow the `resolve`/`reject` naming convention.
    // type: style
    // Requires the parameters of `new Promise((resolve, reject) => {})` to follow a standard naming convention.
    'promise/param-names': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // A promise can be resolved or rejected multiple times in different branches; requires careful control-flow analysis per site.
    // type: bug-prevention
    // Disallows resolving or rejecting a promise more than once within a promise executor.
    'promise/no-multiple-resolved': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: easy
    // `new Promise((resolve, reject) => { ... })` is returned directly from another promise chain; wrapping can be simplified.
    // type: best-practice
    // Disallows returning a `new Promise()` inside a `.then()` handler, which indicates unnecessary promise wrapping.
    'no-promise-executor-return': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: trivial
    // An array is used for membership testing (`arr.includes(x)`) where a `Set` would have O(1) lookup.
    // type: best-practice
    // Prefers `Set.prototype.has()` over `Array.prototype.includes()` for membership tests on large or frequently-queried collections.
    'unicorn/prefer-set-has': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: trivial
    // A variable is immediately mutated after declaration (e.g., `const x = []; x.push(y)`); initialise directly instead.
    // type: style
    // Disallows immediately mutating a variable after its initial declaration/assignment.
    'unicorn/no-immediate-mutation': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: trivial
    // A property is accessed on an `await` expression result inline; introducing an intermediate variable is preferred.
    // type: style
    // Disallows accessing a property directly on an `await` expression; requires storing the awaited value first.
    'unicorn/no-await-expression-member': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: moderate
    // `Array.prototype.reduce()` is used where a more readable loop or built-in method would suffice.
    // type: style
    // Disallows `Array.prototype.reduce()` in favour of more readable alternatives like `for...of` loops or other array methods.
    'unicorn/no-array-reduce': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: moderate
    // A custom `Error` subclass does not follow the expected pattern (name property, correct prototype chain); refactoring requires care.
    // type: best-practice
    // Enforces that custom `Error` subclasses are defined correctly (set `name`, use `super()`, etc.).
    'unicorn/custom-error-definition': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: moderate
    // A `+` operation mixes string and non-string operands in a way that TypeScript considers unsafe; explicit conversion is needed.
    // type: type-safety
    // Disallows the `+` operator when its operands have types that could produce an unintended string/number concatenation.
    'typescript/restrict-plus-operands': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: dangerous
    // A promise is created but not `await`ed or `.catch()`ed, meaning rejection errors would be silently swallowed.
    // type: bug-prevention
    // Disallows floating (unhandled) promises — promises that are neither awaited nor explicitly handled with `.catch()`.
    'typescript/no-floating-promises': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: trivial
    // Generic constructor calls use type argument on the left side (`new Map<string, string>()`) where the right side or inference is preferred (or vice-versa).
    // type: style
    // Enforces a consistent location for type arguments in generic constructor calls (`new Foo<T>()` vs `Foo<T> = new Foo()`).
    'typescript/consistent-generic-constructors': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: moderate
    // A `.then()` chain is nested inside another `.then()`, creating a promise nesting anti-pattern; flattening requires refactoring.
    // type: best-practice
    // Disallows nesting promise `.then()` callbacks inside other `.then()` callbacks.
    'promise/no-nesting': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: trivial
    // A default export is imported using a named import, which may resolve but is fragile and non-standard.
    // type: bug-prevention
    // Disallows importing a module's default export using a named import specifier.
    'import/no-named-as-default': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: trivial
    // A regex is constructed with `new RegExp(...)` using a string literal where a regex literal could be used directly.
    // type: style
    // Prefers regex literals over `new RegExp()` when the pattern is a static string literal.
    'prefer-regex-literals': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: easy
    // `new SomeSideEffect()` is called purely for its side effects without storing the result; this is a code-smell.
    // type: best-practice
    // Disallows `new` expressions used solely for side effects where the constructed object is not used.
    'no-new': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: moderate
    // A file defines more than the allowed number of classes; splitting into separate files may require API adjustments.
    // type: maintainability
    // Enforces a maximum number of class declarations per file to encourage single-responsibility modules.
    'max-classes-per-file': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: easy
    // A `for...in` loop body does not guard against inherited properties with `hasOwnProperty`; adding a guard is mechanical.
    // type: bug-prevention
    // Requires `for...in` loop bodies to filter inherited properties with an `Object.hasOwn()` or `hasOwnProperty` check.
    'guard-for-in': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 1
    // complexity: moderate
    // A class method does not reference `this` and could be a static method or standalone function; refactoring may change call-site API.
    // type: maintainability
    // Requires class methods that do not use `this` to be declared as `static`.
    'class-methods-use-this': 'off',

    // ── Additional type-aware rules surfaced once full type-aware was enabled ──
    // These only report when the tsconfig `rootDir` lets oxlint-tsgolint build a
    // complete program (see tsconfig.json). Same TODO/backlog treatment as above.

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 5
    // complexity: moderate
    // Functions mix value-returning and bare `return`/fall-through paths; normalising requires auditing each branch.
    // type: bug-prevention
    // Requires functions to either always or never return a value (no implicit `undefined` on some paths).
    'typescript/consistent-return': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 4
    // complexity: easy
    // String prefix/suffix checks use indexOf/charAt/regex instead of startsWith/endsWith; mechanical rewrite.
    // type: best-practice
    // Prefers String#startsWith / String#endsWith over equivalent index or regex comparisons.
    'typescript/prefer-string-starts-ends-with': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 4
    // complexity: dangerous
    // The validator intentionally rejects promises with structured validation reports, not Error instances; changing this is an API change.
    // type: bug-prevention
    // Requires Promise rejection reasons to be Error objects.
    'typescript/prefer-promise-reject-errors': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 3
    // complexity: easy
    // Private members that are never reassigned after construction are not marked `readonly`; mechanical fix.
    // type: maintainability
    // Requires private class members that are never reassigned to be declared `readonly`.
    'typescript/prefer-readonly': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: trivial
    // String#match is used without a global flag where RegExp#exec is preferred; mechanical rewrite.
    // type: best-practice
    // Prefers RegExp#exec over String#match when the global flag is not needed.
    'typescript/prefer-regexp-exec': 'off',

    // TODO: evaluate this rule in the future
    // occurrences in codebase: 2
    // complexity: moderate
    // A generic type parameter is used only once and could be inlined; removing it changes the signature.
    // type: maintainability
    // Flags type parameters that appear only once and therefore add no genuine genericity.
    'typescript/no-unnecessary-type-parameters': 'off',
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

# Code Conventions

## Language & Module System

- **TypeScript** with `strict: true`, target `esnext`, module `nodenext`.
- Source is **ESM** (`"type": "module"` in `src/package.json`). All internal imports use `.js` extensions (Node ESM resolution).
- Imports: use `import type { ... }` for type-only imports (enforced by `typescript/consistent-type-imports` via oxlint).
- Import order is enforced by oxfmt `sortImports`: builtins, external packages, internal/subpath, relative imports.

## Formatting

- **oxfmt**: 120 char line width, single quotes, trailing commas (`es5`), semicolons. Also handles import sorting and `package.json` key sorting. Config extends the ultracite preset (`oxfmt.config.ts`).
- **Linting**: oxlint extends the ultracite preset with type-aware linting enabled (`oxlint.config.ts`). Preset rules that currently report on the codebase are disabled with annotated `// TODO` blocks for incremental re-enablement.
- **lefthook**: on commit, JS/TS files are auto-fixed with oxlint and all staged files are formatted with oxfmt (`lefthook.yml`, pre-commit); `pre-push` runs the build + test type-check. Replaces husky + lint-staged.
- Tooling is driven by [ultracite](https://ultracite.ai/) (which wraps oxlint + oxfmt). Run `npm run check` to lint + check formatting without modifying, and `npm run fix` to auto-fix lint issues and format.

## Naming

- Classes: `PascalCase` (`ZSchema`, `SchemaCompiler`, `Report`)
- Interfaces/types: `PascalCase` (`JsonSchema`, `ZSchemaOptions`, `ValidateError`)
- Functions/variables: `camelCase`
- Error codes: `UPPER_SNAKE_CASE` (see `Errors` object in `src/errors.ts`)
- Unused parameters: prefix with `_` (e.g., `_err`)

## Error Handling

- The library uses a **throw-or-return** pattern. The base `ZSchema.validate()` throws `ValidateError` on failure. `ZSchemaSafe.validate()` catches and returns `{ valid, err? }`.
- `ValidateError` extends `Error` with a `.details` property (array of `SchemaErrorDetail`).
- Errors are defined in the `Errors` object in `src/errors.ts` with template strings (`{0}`, `{1}` placeholders).
- To add a new error code, add it to the `Errors` object in `src/errors.ts`.

## Exports

- All public API must be exported through `src/index.ts`.
- Keep internal types (e.g., `JsonSchemaInternal`, compiler metadata) unexported.

## Documentation Comments (TSDoc)

- All public methods and classes must have **TSDoc** comments (`/** ... */`).
- Use `@param name - Description`, `@returns Description`, `@throws Description`, `@example`.
- Do **not** use JSDoc-style type annotations in tags (e.g., `@param {string} name` or `@throws {Error}`) — TypeScript provides the types.
- Use `{@link SymbolName}` for inline cross-references (e.g., `@throws {@link ValidateError} if validation fails`).
- Mark internal-only members with `/** @internal */`.
- Keep descriptions concise — one sentence for simple getters, a short paragraph for complex methods.

## Dependencies

- **Runtime**: `validator` (format validation: email, IP, URL), `punycode` (IDNA A-label transcoding), `safe-regex2` (ReDoS guard). Keep this list short — minimize additions.
- **Optional**: `commander` (CLI support via `bin/z-schema`). Not required for library usage.
- Avoid adding new runtime dependencies unless absolutely necessary. Both UMD targets set `deps: { alwaysBundle: [/.*/] }` in [tsdown.config.ts](../tsdown.config.ts), so every runtime dependency is inlined into `umd/ZSchema.js` **and** `umd/ZSchema.min.js` — a dependency carrying a large Unicode table (e.g. `tr46`, ~220 KB) roughly doubles the browser bundle. Prefer a narrow hand-rolled implementation when it covers the required behavior; see the UTS 46 mapping step in [src/utils/hostname.ts](../src/utils/hostname.ts).

## Utility Functions

- Pure utility functions go in `src/utils/`. Each file is single-purpose.
- Current utils: `array.ts`, `clone.ts`, `json.ts`, `properties.ts`, `rfc-3986.ts`, `rfc-3987.ts`, `schema-regex.ts`, `symbols.ts`, `unicode.ts`, `uri.ts`, `what-is.ts`.

## Performance

Performance is a **primary, non-negotiable goal** — z-schema validates JSON on hot paths that run millions of times. Never trade a faster construct for stylistic sugar. See the Performance section in [AGENTS.md](../AGENTS.md#performance) for the authoritative rule list; the patterns below show the canonical before/after forms.

**Prefer faster array/string primitives:**

```ts
// ✗ spread (iterator protocol)            ✓ concat / slice
const a = [...x, ...y];                     const a = x.concat(y);
const b = [...x];                           const b = x.slice();
report.path.push(...segs);                  for (let i = 0; i < segs.length; i++) report.path.push(segs[i]);

// ✗ for…of / forEach on hot arrays         ✓ indexed for
for (const k of keys) use(k);               for (let i = 0; i < keys.length; i++) use(keys[i]);

// ✗ O(n) membership in a loop              ✓ O(1) Set
if (propKeys.includes(key)) …               const propKeySet = new Set(propKeys); … if (propKeySet.has(key)) …

// ✗ codePointAt for ASCII/surrogate scan   ✓ charCodeAt
str.codePointAt(i)                          str.charCodeAt(i)
```

**Avoid per-call / per-iteration allocations** — hoist constants, option objects, and regex compilation; mutate in place; resolve single values directly:

```ts
// ✗ option literal allocated per iteration
for (const v of enumVals) if (areEqual(json, v, { maxDepth })) …
// ✓ hoisted once
const eqOpts = { maxDepth };
for (let i = 0; i < enumVals.length; i++) if (areEqual(json, enumVals[i], eqOpts)) …

// ✗ regex compiled per data key            ✓ compiled once before the loop
for (const key of keys) { const re = compileSchemaRegex(p); … }
const compiled = patterns.map(compileSchemaRegex); for (…) { /* reuse compiled */ }

// ✗ allocating filter/concat on a hot path ✓ in-place (private local arrays only)
keys = keys.filter((k) => k !== '$ref');    const i = keys.indexOf('$ref'); if (i !== -1) keys.splice(i, 1);
report.errors = report.errors.concat(sub);  for (let i = 0; i < sub.length; i++) report.errors.push(sub[i]);

// ✗ build a big merged object to read one key   ✓ resolve the single value directly
const all = getFormatValidators(opts); all[name];   resolveFormatValidator(name, opts);
```

**Lint interaction:** rules that would push code back to the slower form are kept `off` in [oxlint.config.ts](../oxlint.config.ts) under the "Intentionally kept off for performance" block (`unicorn/prefer-spread`, `typescript/prefer-for-of`, `unicorn/prefer-code-point`). Do not re-enable them; if a perf change trips another enabled rule, disable that rule there rather than reverting the faster code.

**Behavior preservation is mandatory:** a faster path must be identical for all inputs (lone surrogates, duplicate ids, empty collections, etc.). The full test suite is the gate; in-place mutation is only safe when the array is a private local with no caller relying on a fresh reference.

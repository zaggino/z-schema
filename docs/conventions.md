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

- **Runtime**: `validator` (format validation: email, IP, URL). One dependency only — minimize additions.
- **Optional**: `commander` (CLI support via `bin/z-schema`). Not required for library usage.
- Avoid adding new runtime dependencies unless absolutely necessary.

## Utility Functions

- Pure utility functions go in `src/utils/`. Each file is single-purpose.
- Current utils: `array.ts`, `clone.ts`, `json.ts`, `properties.ts`, `schema-regex.ts`, `symbols.ts`, `unicode.ts`, `uri.ts`, `what-is.ts`.

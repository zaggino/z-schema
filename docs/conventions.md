# Code Conventions

## Language & Module System

- **TypeScript** with `strict: true`, target `esnext`, module `nodenext`.
- Source is **ESM** (`"type": "module"` in `src/package.json`). All internal imports use `.js` extensions (Node ESM resolution).
- Imports: use `import type { ... }` for type-only imports (enforced by `@typescript-eslint/consistent-type-imports`).
- Import order is enforced by `eslint-plugin-simple-import-sort`:
  1. Type-only imports
  2. Side-effect imports
  3. `node:` builtins
  4. Packages (`@scope/...` or bare)
  5. Absolute/alias imports
  6. Relative non-JSON imports
  7. Relative JSON imports

## Formatting

- **Prettier**: 120 char line width, single quotes, trailing commas (`es5`), semicolons.
- **Lint-staged**: on commit, files are auto-fixed with ESLint + Prettier (configured in `lint-staged.config.mjs`).
- Run `npm run format` to format all files, `npm run format:check` to check without modifying.
- Run `npm run lint` to lint + fix, `npm run lint:check` to lint without fixing.

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

## Dependencies

- **Runtime**: `validator` (format validation: email, IP, URL). One dependency only — minimize additions.
- **Optional**: `commander` (CLI support via `bin/z-schema`). Not required for library usage.
- Avoid adding new runtime dependencies unless absolutely necessary.

## Utility Functions

- Pure utility functions go in `src/utils/`. Each file is single-purpose.
- Current utils: `array.ts`, `clone.ts`, `json.ts`, `properties.ts`, `schema-regex.ts`, `symbols.ts`, `unicode.ts`, `uri.ts`, `what-is.ts`.

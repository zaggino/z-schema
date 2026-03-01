# Contributing / PR Guide

## Repository Setup

This repository uses git submodules. Clone with:

```bash
git clone --recursive https://github.com/zaggino/z-schema.git
cd z-schema
npm install
```

If already cloned without `--recursive`:

```bash
git submodule update --init --recursive
```

## Commit Messages

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification).

Format: `<type>[optional scope]: <description>`

Common types:

| Type       | When to use                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | A new feature                                           |
| `fix`      | A bug fix                                               |
| `docs`     | Documentation-only changes                              |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or updating tests                                |
| `chore`    | Build process, CI, tooling, dependency updates          |

Examples:

```
feat: add maxRecursionDepth option
fix: prevent global_cache mutation in fromCache
refactor(schema-cache): cache global clone in instance cache
docs: add conventional commits guide
feat!: remove deprecated constructor (BREAKING CHANGE)
```

Append `!` after the type/scope for breaking changes, or include a `BREAKING CHANGE:` footer in the commit body.

## Branch & PR Workflow

1. Create a feature branch from `main` (the active development branch):
   ```bash
   git checkout -b feature/my-change main
   ```
2. Make your changes following the [code conventions](conventions.md).
3. Run the full check suite before pushing:
   ```bash
   npm run lint:check
   npm run format:check
   npm run build
   npm run build:tests
   npm test
   ```
4. Push and open a PR against the `main` branch.

## Making Changes

### Adding a New Feature

1. Implement the feature in the appropriate `src/` file.
2. Export any new public types/values through `src/index.ts`.
3. Write tests in `test/spec/` using the correct suffix (`.spec.ts` for both environments, `.node-spec.ts` for node-only, `.browser-spec.ts` for browser-only).
4. If the feature relates to a JSON Schema keyword from the test suite, remove the relevant entries from `excludedFiles` / `excludedTests` in `test/spec/json-schema-test-suite.common.ts` and confirm tests pass.
5. Update documentation in `docs/` if the feature affects the public API.

### Adding a New Error Code

1. Add the error to the `Errors` object in `src/errors.ts` using `UPPER_SNAKE_CASE` and template placeholders (`{0}`, `{1}`).
2. Use `report.addError(code, params)` in the relevant validation logic.
3. Add tests that verify the error code is produced.

### Adding a New Format Validator

1. Add the validator function in `src/format-validators.ts`.
2. Register it in the `inbuiltValidators` record.
3. Add tests in `test/spec/format-validators.spec.ts`.

### Adding a New Utility

1. Create a new file in `src/utils/` — each file should be single-purpose.
2. Import it where needed using `.js` extension (ESM convention).
3. Do **not** export utilities from `src/index.ts` unless they are part of the public API.

### Modifying Options

1. Add the option to the `ZSchemaOptions` interface in `src/z-schema-options.ts`.
2. Add a default value to the `defaultOptions` object in the same file.
3. If the option affects `strictMode`, add it to the `strictMode` block in `normalizeOptions`.
4. Document the option in `docs/options.md`.
5. Add tests.

## Code Quality Checks

| Check           | Command                 | Notes                                         |
| --------------- | ----------------------- | --------------------------------------------- |
| Lint            | `npm run lint:check`    | ESLint with TS rules + import sort            |
| Format          | `npm run format:check`  | Prettier (120 cols, single quotes, semi, es5) |
| Build           | `npm run build`         | TypeScript compilation + Rollup bundling      |
| Test type-check | `npm run build:tests`   | Type-check test files without running them    |
| Tests (all)     | `npm test`              | Vitest — node + browser projects              |
| Tests (node)    | `npm run test:node`     | Node-only tests with output                   |
| Tests (browser) | `npm run test:browser`  | Browser tests (Chromium, Firefox, WebKit)     |
| Coverage        | `npm run test:coverage` | Istanbul coverage for `src/`                  |

## Pre-commit & Pre-push Hooks

- **Pre-commit** (via Husky + lint-staged): auto-runs ESLint fix + Prettier on staged files.
- **Pre-push**: runs `npm run build && npm run build:tests` to catch build/type errors.

## File Organization Rules

- All public exports go through `src/index.ts`.
- Internal types (e.g., `JsonSchemaInternal`, compiler metadata) stay unexported.
- Tests go in `test/spec/` with appropriate suffix.
- Test fixtures go in `test/fixtures/`.
- Pure utility functions go in `src/utils/` (one file per concern).
- Use `import type` for type-only imports.
- Use `.js` extension in `src/` imports (ESM), `.ts` extension in `test/` imports (enabled by `allowImportingTsExtensions`).

## Common Pitfalls

- **Never use `new ZSchema()`** — always use `ZSchema.create()`.
- **`ValidateError.details`** (not `.errors`) is the array of error objects.
- **Default version is `draft2020-12`**. Specify `version: 'draft-04'`, `'draft-06'`, `'draft-07'`, `'draft2019-09'`, `'draft2020-12'` or `none` explicitly if needed.
- **Import extensions**: `src/` uses `.js`, `test/` uses `.ts`.
- **Schemas in `src/schemas/`** are generated by `scripts/copy-schemas.mts` at build time — do not edit them manually.
- **`json-schema-spec/`** is a git submodule — do not commit changes to it directly.

## Coverage Artifact Auto-Updates in PRs

For pull requests, CI may auto-commit coverage artifacts (`docs/test-coverage.md` and `README.md`) when they change.

- Auto-commit runs only for **same-repository** pull requests.
- Auto-commit is skipped for fork pull requests.
- Auto-commit is skipped when the actor is `github-actions[bot]`.
- Only coverage artifact files are staged for this CI-authored commit.
- Coverage artifact update logic is serialized per PR branch with cancel-in-progress behavior to avoid commit races.

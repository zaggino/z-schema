---
name: contributing-to-z-schema
description: Guides contributors through the z-schema codebase, PR workflow, and common development tasks. Use when the user wants to contribute to z-schema, add a new feature or keyword, add an error code, add a format validator, modify options, write tests, run the test suite, fix a failing test, understand the validation pipeline, navigate the source code architecture, or submit a pull request. Also use when someone mentions contributing, PRs, the z-schema source code, or the JSON Schema Test Suite integration.
---

# Contributing to z-schema

z-schema is a JSON Schema validator (draft-04 through draft-2020-12) written in TypeScript. This skill covers the development workflow, codebase navigation, and common contribution tasks.

## Repository setup

```bash
git clone --recursive https://github.com/zaggino/z-schema.git
cd z-schema
npm install
```

If already cloned without `--recursive` (needed for the `json-schema-spec/` submodule):

```bash
git submodule update --init --recursive
```

## Quality checks

Run all checks before pushing:

```bash
npm run lint:check      # ESLint
npm run format:check    # Prettier
npm run build           # TypeScript + Rollup
npm run build:tests     # Type-check tests
npm test                # Vitest (node + browser)
```

Pre-commit hooks auto-run lint + format on staged files. Pre-push hooks run build + type-check.

## Codebase map

```
src/
  index.ts              → Public API (all exports)
  z-schema.ts           → Factory + ZSchema/ZSchemaSafe/ZSchemaAsync/ZSchemaAsyncSafe
  z-schema-base.ts      → Core validation orchestration
  schema-compiler.ts    → $ref resolution, id collection, schema compilation
  schema-validator.ts   → Schema-level validation against meta-schemas
  json-validation.ts    → Instance validation (type, constraints, combiners)
  schema-cache.ts       → Schema caching by URI/id
  errors.ts             → Error codes (Errors object) + ValidateError class
  format-validators.ts  → Built-in + custom format validators
  report.ts             → Error accumulation (Report, SchemaErrorDetail)
  json-schema.ts        → Common JSON Schema definitions + helpers
  json-schema-versions.ts → Draft-specific type unions + version mappings
  z-schema-options.ts   → Options interface + defaults + normalizeOptions
  z-schema-reader.ts    → Schema reader type
  z-schema-versions.ts  → Registers bundled meta-schemas into cache
  utils/                → Pure utilities (array, clone, json, uri, etc.)
  schemas/              → Bundled meta-schemas (generated at build time)
```

## Validation pipeline

1. **Schema compilation** (`schema-compiler.ts`): resolves `$ref`, collects `id`/`$id`, registers in cache
2. **Schema validation** (`schema-validator.ts`): validates schema against its meta-schema
3. **JSON validation** (`json-validation.ts`): validates data against compiled schema — type checks, constraints, combiners (`allOf`/`anyOf`/`oneOf`/`not`), `unevaluated*` tracking, format checks
4. **Report** (`report.ts`): errors accumulate in a `Report`, then convert to `ValidateError`

## Common tasks

### Adding a new error code

1. Add the error to the `Errors` object in `src/errors.ts`:
   ```typescript
   MY_NEW_ERROR: 'Description with {0} placeholder',
   ```
2. Use `report.addError('MY_NEW_ERROR', [param])` in the validation logic.
3. Write tests verifying the error code is produced.

### Adding a new format validator

1. Write the validator function in `src/format-validators.ts`:
   ```typescript
   const myFormatValidator: FormatValidatorFn = (input: unknown) => {
     if (typeof input !== 'string') return true;
     return /^pattern$/.test(input);
   };
   ```
2. Register it in the `inbuiltValidators` record:
   ```typescript
   const inbuiltValidators = {
     // ...existing
     'my-format': myFormatValidator,
   };
   ```
3. Add tests in `test/spec/format-validators.spec.ts`.

### Adding a new option

1. Add the option to `ZSchemaOptions` in `src/z-schema-options.ts`.
2. Add a default value in `defaultOptions`.
3. If the option is part of `strictMode`, add it to the `strictMode` block in `normalizeOptions`.
4. Document it in `docs/options.md`.
5. Write tests.

### Implementing a new JSON Schema keyword

1. Add validation logic in `src/json-validation.ts` (for data validation) or `src/schema-validator.ts` (for schema-level validation).
2. Guard with a draft version check if the keyword is draft-specific.
3. Remove relevant entries from `excludedFiles`/`excludedTests` in `test/spec/json-schema-test-suite.common.ts`.
4. Run the JSON Schema Test Suite to confirm compliance:
   ```bash
   npx vitest run --silent=false --project node -t "draft2020-12/newKeyword"
   ```
5. Export any new types through `src/index.ts`.

### Modifying existing behavior

1. Find the relevant module using the codebase map above.
2. Make changes following code conventions (see below).
3. Run the full test suite — regressions often appear in other drafts.

## Test framework

- **Vitest** with `globals: true`.
- Two projects: **node** and **browser** (Playwright: Chromium, Firefox, WebKit).
- Tests live in `test/spec/`.

### File naming

| Suffix              | Runs in               |
| ------------------- | --------------------- |
| `*.spec.ts`         | Both node and browser |
| `*.node-spec.ts`    | Node only             |
| `*.browser-spec.ts` | Browser only          |

### Running tests

```bash
npm test                                                        # all
npm run test:node                                               # node only
npx vitest run --silent=false --project node -t "draft4/type"   # single test
npm run test:coverage                                           # coverage
```

### Test pattern

```typescript
import { ZSchema } from '../../src/z-schema.ts';

describe('Feature Name', () => {
  it('should accept valid data', () => {
    const validator = ZSchema.create();
    expect(validator.validate('hello', { type: 'string' })).toBe(true);
  });

  it('should reject invalid data', () => {
    const validator = ZSchema.create();
    const { valid, err } = validator.validateSafe(42, { type: 'string' });
    expect(valid).toBe(false);
    expect(err?.details?.[0]?.code).toBe('INVALID_TYPE');
  });
});
```

### JSON Schema Test Suite

Official test cases loaded via `test/spec/json-schema-test-suite.common.ts`. To enable tests for a newly implemented feature, remove entries from `excludedFiles` / `excludedTests` and confirm they pass.

## Code conventions

- TypeScript `strict: true`, ESM with `.js` import extensions in `src/`
- `.ts` import extensions in `test/` (via `allowImportingTsExtensions`)
- `import type` for type-only imports (enforced by ESLint)
- Import order: type-only → side-effect → node builtins → packages → relative
- Prettier: 120 char width, single quotes, trailing commas (es5), semicolons
- Classes/types: `PascalCase` — functions/variables: `camelCase` — errors: `UPPER_SNAKE_CASE`
- All public API exported through `src/index.ts`
- Internal types stay unexported
- Schemas in `src/schemas/` are generated by `scripts/copy-schemas.mts` — do not edit manually
- `json-schema-spec/` is a git submodule — do not commit changes to it

## PR checklist

```
- [ ] Branch from `main`
- [ ] Changes follow code conventions
- [ ] npm run lint:check passes
- [ ] npm run format:check passes
- [ ] npm run build passes
- [ ] npm run build:tests passes
- [ ] npm test passes (node + browser)
- [ ] New public types/values exported through src/index.ts
- [ ] New features have tests
- [ ] docs/ updated if public API changed
- [ ] JSON Schema Test Suite entries un-excluded if applicable
```

## Reference files

- [references/architecture-details.md](references/architecture-details.md) — Full module dependency diagram, factory pattern, build outputs, and internal types

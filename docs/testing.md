# Testing Guide

## Framework

- **Vitest** with `globals: true` (no need to import `describe`, `it`, `expect` in most files).
- Two test projects: **node** and **browser** (Playwright with Chromium, Firefox, WebKit).

## File Naming

| Suffix              | Runs in               |
| ------------------- | --------------------- |
| `*.spec.ts`         | Both node and browser |
| `*.node-spec.ts`    | Node only             |
| `*.browser-spec.ts` | Browser only          |

All test files live in `test/spec/`.

## Running Tests

```bash
# All tests
npm test

# Node only (with output)
npm run test:node

# Browser only
npm run test:browser

# Single test by name pattern
npx vitest run --silent=false --project node -t "draft4/type.json"

# Type-check test files (no execution)
npm run build:tests

# Coverage report
npm run test:coverage
npm run coverage:artifacts
```

## Test Imports

Tests import source directly from `../../src/*.ts` using `.ts` extensions (enabled by `allowImportingTsExtensions` in `test/tsconfig.json`):

```typescript
import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { ZSchema } from '../../src/z-schema.ts';
```

When using vitest globals that need explicit import (e.g., in files that also run in browser context), import from `vitest`:

```typescript
import { describe, expect, it } from 'vitest';
```

## JSON Schema Test Suite

The official [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) is used via `test/spec/json-schema-test-suite.common.ts`. It dynamically loads test cases from `test/public/json-schema-test-suite/validation/tests/`.

The suite is one set of files shared by every draft. `test/lib/json-schema-test-suite.ts` turns it into per-draft tests:

- A test case's `compatibility` property says which drafts it applies to; the case runs once for each tested draft it covers. A case for a later release than the tested drafts (`9999` marks features not yet released) runs for none of them. The draft's `$schema` is added to a schema that does not name one; the few cases that bring their own meta-schema keep it.
- A test case's `externalSchemas` are registered on the validator created for that test, never globally: the same URI can name different schemas in different cases.
- A test case tagged `format-assertion` runs with `formatAssertions: null`; one tagged `format-annotation` runs with `formatAssertions: true` on draft 2019-09 / 2020-12 and `false` on older drafts. Untagged cases run with `formatAssertions: true` on draft 2019-09 / 2020-12, so that a case with its own meta-schema is decided by its vocabulary, and with the default options on older drafts. A tag the harness does not know fails the run, so that a new upstream tag gets a decision instead of the defaults.
- A file is reported per draft as `<draft>/<file>`, e.g. `draft4/type.json` or `draft2020-12/optional/bignum.json`.
- Known-failing or unsupported tests are listed in `EXCLUSIONS` in `test/lib/json-schema-test-suite.ts`. An entry names the suite file (relative to `validation/tests/`) and the reason, and optionally the drafts (`versions`) and the tests (`tests`, each as `<case description> <test description>`) it is limited to; without `tests` it excludes the whole file.
- When implementing a new draft feature, remove the corresponding entries from `EXCLUSIONS` and ensure the tests pass.
- `test/spec/json-schema-test-suite-selection.node-spec.ts` guards the selection itself: the `compatibility` matching, a minimum number of tests per draft, and that every `EXCLUSIONS` entry still matches something (upstream renames would otherwise leave dead entries).

## Legacy Z-Schema Test Suite

`test/ZSchemaTestSuite/` contains TypeScript test fixture files (`.ts`) that test z-schema-specific features, options, and edge cases. These are loaded and run by `test/spec/z-schema-test-suite.spec.ts`.

## Test Setup

`test/vitest.setup.ts` runs `createManifest()` from `test/lib/create-manifest.ts` as a global setup — this lists the `.json` files under `test/public` and provides the list to the tests, which read it with `inject('publicFiles')`. Nothing is written to disk.

## Writing Tests

Standard pattern:

```typescript
import { ZSchema } from '../../src/z-schema.ts';

describe('Feature Name', () => {
  it('should do X', () => {
    const validator = ZSchema.create();
    const schema = { type: 'string' };
    const result = validator.validate('hello', schema);
    expect(result).toBe(true);
  });

  it('should reject invalid data (safe mode)', () => {
    const validator = ZSchema.create();
    const schema = { type: 'number' };
    const { valid, err } = validator.validateSafe('not a number', schema);
    expect(valid).toBe(false);
    expect(err?.details?.[0]?.code).toBe('INVALID_TYPE');
  });

  it('should reject invalid data (throw mode)', () => {
    const validator = ZSchema.create();
    const schema = { type: 'number' };
    expect(() => validator.validate('not a number', schema)).toThrow();
  });
});
```

### Error Inspection

`ValidateError` has a `.details` property (array of `SchemaErrorDetail`):

```typescript
interface SchemaErrorDetail {
  message: string; // Human-readable error message
  code: string; // Error code (e.g., 'INVALID_TYPE')
  params: ErrorParam[]; // Parameters used in the error template
  path: string | Array<string | number>; // JSON path to the failing value
  schemaPath?: Array<string | number>; // Path in the schema to the constraint
  title?: string; // Schema title (if present)
  description?: string; // Schema description (if present)
  inner?: SchemaErrorDetail[]; // Sub-errors (e.g., for oneOf/anyOf)
  schemaId?: string; // Schema id (if present)
  keyword?: string; // Schema keyword that caused the error (e.g., "required", "type")
}
```

## Coverage

```bash
npm run test:coverage
```

Coverage provider: Istanbul. Covers `src/` only, excluding `src/package.json` and `src/schemas/*.json`.

Generated coverage artifacts:

- `docs/test-coverage.md` (deterministic markdown coverage summary with rounded whole percentages)
  - Per-file table columns: `File`, `Line %`, `Statement %`, `Function %`, `Branch %`
  - Final `Total` row across all listed files
- `README.md` coverage badge (derived from rounded total line coverage)

Badge mapping:

- `high` (`>= 90`): `brightgreen`
- `medium` (`>= 80` and `< 90`): `yellow`
- `low` (`< 80`): `red`

Threshold evaluation uses rounded whole-percent line coverage.

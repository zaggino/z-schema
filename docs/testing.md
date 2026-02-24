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
```

## Test Imports

Tests import source directly from `../../src/*.ts` using `.ts` extensions (enabled by `allowImportingTsExtensions` in `test/tsconfig.json`):

```typescript
import { ZSchema } from '../../src/z-schema.ts';
import type { JsonSchema } from '../../src/json-schema-versions.ts';
```

When using vitest globals that need explicit import (e.g., in files that also run in browser context), import from `vitest`:

```typescript
import { describe, expect, it } from 'vitest';
```

## JSON Schema Test Suite

The official [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) is used via `test/spec/json-schema-test-suite.common.ts`. It dynamically loads test cases from `test/public/json-schema-test-suite/`.

- Known-failing or unsupported tests are listed in `excludedFiles` and `excludedTests` arrays in `json-schema-test-suite.common.ts`.
- When implementing a new draft feature, remove the corresponding entries from these exclusion lists and ensure the tests pass.

## Legacy Z-Schema Test Suite

`test/ZSchemaTestSuite/` contains legacy test files (mostly `.js`) that test z-schema-specific features, options, and edge cases. These are loaded and run by `test/spec/z-schema-test-suite.spec.ts`.

## Test Setup

`test/vitest.setup.ts` runs `createManifest()` from `test/lib/create-manifest.ts` as a global setup — this generates a manifest of available test suite files before tests run.

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
}
```

## Coverage

```bash
npm run test:coverage
```

Coverage provider: Istanbul. Covers `src/` only, excluding `src/package.json` and `src/schemas/*.json`.

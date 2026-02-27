---
name: validating-json-data
description: Validates JSON data against JSON Schema using the z-schema library. Use when the user needs to validate JSON, check data against a schema, handle validation errors, use custom format validators, work with JSON Schema drafts 04 through 2020-12, set up z-schema in a project, compile schemas with cross-references, resolve remote $ref, configure validation options, or inspect error details. Covers sync/async modes, safe error handling, schema pre-compilation, remote references, TypeScript types, and browser/UMD usage.
---

# Validating JSON Data with z-schema

z-schema validates JSON data against JSON Schema (draft-04, draft-06, draft-07, draft-2019-09, draft-2020-12). Default draft: **draft-2020-12**.

## Quick start

```typescript
import ZSchema from 'z-schema';

const validator = ZSchema.create();

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
};

// Throws on invalid data
validator.validate({ name: 'Alice', age: 30 }, schema);
```

Install: `npm install z-schema`

## Choosing a validation mode

z-schema has four modes based on two toggles: `async` and `safe`. Pick the one that fits the use case.

| Mode        | Factory call                                  | Returns                          | Use when                                 |
| ----------- | --------------------------------------------- | -------------------------------- | ---------------------------------------- |
| Sync throw  | `ZSchema.create()`                            | `true` or throws `ValidateError` | Default — simple scripts and middleware  |
| Sync safe   | `ZSchema.create({ safe: true })`              | `{ valid, err? }`                | Need to inspect errors without try/catch |
| Async throw | `ZSchema.create({ async: true })`             | `Promise<true>` or rejects       | Using async format validators            |
| Async safe  | `ZSchema.create({ async: true, safe: true })` | `Promise<{ valid, err? }>`       | Async + non-throwing                     |

### Sync throw (default)

```typescript
import ZSchema from 'z-schema';

const validator = ZSchema.create();

try {
  validator.validate(data, schema);
} catch (err) {
  // err is ValidateError
  console.log(err.details); // SchemaErrorDetail[]
}
```

### Sync safe

```typescript
const validator = ZSchema.create({ safe: true });

const result = validator.validate(data, schema);
if (!result.valid) {
  console.log(result.err?.details);
}
```

Or call `.validateSafe()` on a regular (throwing) validator for the same result shape:

```typescript
const validator = ZSchema.create();
const { valid, err } = validator.validateSafe(data, schema);
```

### Async throw

Required when using async format validators.

```typescript
const validator = ZSchema.create({ async: true });

try {
  await validator.validate(data, schema);
} catch (err) {
  console.log(err.details);
}
```

### Async safe

```typescript
const validator = ZSchema.create({ async: true, safe: true });

const { valid, err } = await validator.validate(data, schema);
```

## Inspecting errors

`ValidateError` has `.details` — an array of `SchemaErrorDetail`:

```typescript
interface SchemaErrorDetail {
  message: string; // "Expected type string but found type number"
  code: string; // "INVALID_TYPE"
  params: (string | number | Array<string | number>)[];
  path: string | Array<string | number>; // "#/age" or ["age"]
  keyword?: string; // "type", "required", "minLength", etc.
  inner?: SchemaErrorDetail[]; // sub-errors from anyOf/oneOf/not
  schemaPath?: Array<string | number>;
  schemaId?: string;
}
```

### Example: walking nested errors

Combinators (`anyOf`, `oneOf`, `not`) produce nested `inner` errors:

```typescript
const { valid, err } = validator.validateSafe(data, schema);
if (!valid && err) {
  for (const detail of err.details) {
    console.log(`${detail.path}: [${detail.code}] ${detail.message}`);
    if (detail.inner) {
      for (const sub of detail.inner) {
        console.log(`  └─ ${sub.path}: [${sub.code}] ${sub.message}`);
      }
    }
  }
}
```

### Filtering errors

Pass `ValidateOptions` as the third argument to include or exclude specific error codes:

```typescript
// Only report type errors
validator.validate(data, schema, { includeErrors: ['INVALID_TYPE'] });

// Suppress string-length errors
validator.validate(data, schema, { excludeErrors: ['MIN_LENGTH', 'MAX_LENGTH'] });
```

For the full error code list, see [references/error-codes.md](references/error-codes.md).

## Schema pre-compilation

Compile schemas at startup for better runtime performance and to resolve cross-references:

```typescript
const validator = ZSchema.create();

const schemas = [
  {
    id: 'address',
    type: 'object',
    properties: { city: { type: 'string' }, zip: { type: 'string' } },
    required: ['city'],
  },
  {
    id: 'person',
    type: 'object',
    properties: {
      name: { type: 'string' },
      home: { $ref: 'address' },
    },
    required: ['name'],
  },
];

// Compile all schemas (validates them and registers references)
validator.validateSchema(schemas);

// Validate data using a compiled schema ID
validator.validate({ name: 'Alice', home: { city: 'Paris' } }, 'person');
```

## Remote references

### Manual registration

```typescript
ZSchema.setRemoteReference('http://example.com/schemas/address.json', addressSchema);
// or per-instance:
validator.setRemoteReference('http://example.com/schemas/person.json', personSchema);
```

### Automatic loading via schema reader

```typescript
import fs from 'node:fs';
import path from 'node:path';

ZSchema.setSchemaReader((uri) => {
  const filePath = path.resolve(__dirname, 'schemas', uri + '.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
});
```

### Diagnosing missing references

```typescript
const { valid, err } = validator.validateSafe(data, schema);
if (!valid && err) {
  const missing = validator.getMissingReferences(err);
  const remote = validator.getMissingRemoteReferences(err);
}
```

## Custom format validators

### Global (shared across all validator instances)

```typescript
ZSchema.registerFormat('postal-code', (value) => {
  return typeof value === 'string' && /^\d{5}(-\d{4})?$/.test(value);
});
```

### Instance-scoped

```typescript
const validator = ZSchema.create();
validator.registerFormat('postal-code', (value) => {
  return typeof value === 'string' && /^\d{5}(-\d{4})?$/.test(value);
});
```

### Via options at creation time

```typescript
const validator = ZSchema.create({
  customFormats: {
    'postal-code': (value) => typeof value === 'string' && /^\d{5}(-\d{4})?$/.test(value),
  },
});
```

### Async format validators

Return `Promise<boolean>`. Requires `{ async: true }`.

```typescript
const validator = ZSchema.create({ async: true });
validator.registerFormat('user-exists', async (value) => {
  if (typeof value !== 'number') return false;
  const user = await db.findUser(value);
  return user != null;
});
```

### Listing registered formats

```typescript
const formats = ZSchema.getRegisteredFormats();
```

## Choosing a draft version

Set the draft explicitly if the schema targets a specific version:

```typescript
const validator = ZSchema.create({ version: 'draft-07' });
```

Valid values: `'draft-04'`, `'draft-06'`, `'draft-07'`, `'draft2019-09'`, `'draft2020-12'` (default), `'none'`.

For a feature comparison across drafts, see [references/draft-comparison.md](references/draft-comparison.md).

## Common options

| Option                 | Default | Purpose                                                                  |
| ---------------------- | ------- | ------------------------------------------------------------------------ |
| `breakOnFirstError`    | `false` | Stop validation at the first error                                       |
| `noEmptyStrings`       | `false` | Reject empty strings as type `string`                                    |
| `noEmptyArrays`        | `false` | Reject empty arrays as type `array`                                      |
| `strictMode`           | `false` | Enable all strict checks at once                                         |
| `ignoreUnknownFormats` | `false` | Suppress unknown format errors (modern drafts always ignore)             |
| `formatAssertions`     | `null`  | `null`=always assert, `true`=respect vocabulary, `false`=annotation-only |
| `reportPathAsArray`    | `false` | Report error paths as arrays instead of JSON Pointer strings             |

For the full options reference, see [references/options.md](references/options.md).

## Validating sub-schemas

Target a specific path within a schema:

```typescript
validator.validate(carData, fullSchema, { schemaPath: 'definitions.car' });
```

## Browser usage (UMD)

```html
<script src="node_modules/z-schema/umd/ZSchema.min.js"></script>
<script>
  var validator = ZSchema.create();
  try {
    validator.validate({ name: 'test' }, { type: 'object' });
  } catch (err) {
    console.log(err.details);
  }
</script>
```

## TypeScript types

All types are exported from the package:

```typescript
import type {
  JsonSchema, // Schema type (all drafts union)
  ZSchemaOptions, // Configuration options
  ValidateOptions, // Per-call options (schemaPath, includeErrors, excludeErrors)
  ValidateResponse, // { valid: boolean, err?: ValidateError }
  SchemaErrorDetail, // Individual error detail
  ErrorCode, // Error code string literal type
  FormatValidatorFn, // (input: unknown) => boolean | Promise<boolean>
  SchemaReader, // (uri: string) => JsonSchema
} from 'z-schema';

import { ValidateError } from 'z-schema';
```

## Reference files

- [references/error-codes.md](references/error-codes.md) — Full error code list with descriptions and examples
- [references/options.md](references/options.md) — Complete options reference with defaults
- [references/draft-comparison.md](references/draft-comparison.md) — Feature comparison across JSON Schema drafts

## Important conventions

- Always use `ZSchema.create(options?)` — never `new ZSchema()`. The factory returns the correctly typed variant.
- Error details are on `.details` (not `.errors`).
- Import types with `import type { ... }` and values with `import { ValidateError }`.
- Default draft is `draft2020-12`. Specify explicitly if targeting an older draft.

# Library Usage Guide

How to use z-schema as a dependency in other projects for JSON Schema validation. Supports JSON Schema **draft-04**, **draft-06**, **draft-07**, **draft-2019-09**, and **draft-2020-12** (latest).

## Installation

```bash
npm install z-schema
```

## Import

```typescript
// ESM / TypeScript
import ZSchema from 'z-schema';

// Or named import
import { ZSchema } from 'z-schema';

// CommonJS
const ZSchema = require('z-schema');
```

## Creating a Validator

Always use `ZSchema.create()` — never `new ZSchema()`.

```typescript
const validator = ZSchema.create();
```

### With Options

```typescript
const validator = ZSchema.create({
  version: 'draft2020-12', // 'draft-04' | 'draft-06' | 'draft-07' | 'draft2019-09' | 'draft2020-12' | 'none' (default: 'draft2020-12')
  breakOnFirstError: false, // stop at first error (default: false)
  noEmptyStrings: true, // reject empty strings for type 'string' (default: false)
  noEmptyArrays: true, // reject empty arrays for type 'array' (default: false)
  noTypeless: true, // require 'type' in schemas (default: false)
  strictMode: false, // enable multiple strict checks at once (default: false)
  ignoreUnknownFormats: false, // suppress UNKNOWN_FORMAT errors for older drafts (default: false; modern drafts always ignore unknown formats)
  formatAssertions: null, // null=always assert, true=respect vocabulary (annotation-only for 2019-09/2020-12), false=annotation-only (default: null)
  ignoreUnresolvableReferences: false, // skip unresolvable $ref (default: false)
  maxRecursionDepth: 100, // max depth for internal traversal (prevents stack overflow on deep schemas/data)
});
```

See [Options](options.md) for the full list of options and detailed descriptions.

## Validation Modes

### Sync (throws on error) — default

```typescript
const validator = ZSchema.create();

try {
  validator.validate(data, schema);
  // validation passed — returns true
} catch (err) {
  console.log(err.name); // 'z-schema validation error'
  console.log(err.message); // summary message
  console.log(err.details); // SchemaErrorDetail[]
}
```

### Sync Safe (returns result object)

```typescript
const validator = ZSchema.create({ safe: true });

const result = validator.validate(data, schema);
// result: { valid: boolean, err?: ValidateError }
if (!result.valid) {
  console.log(result.err?.details);
}
```

Or use the convenience method on a regular validator:

```typescript
const validator = ZSchema.create();
const result = validator.validateSafe(data, schema);
```

### Async (promise, throws on error)

Required when using async format validators.

```typescript
const validator = ZSchema.create({ async: true });

try {
  await validator.validate(data, schema);
  // validation passed
} catch (err) {
  console.log(err.details);
}
```

### Async Safe (promise, returns result object)

```typescript
const validator = ZSchema.create({ async: true, safe: true });

const result = await validator.validate(data, schema);
if (!result.valid) {
  console.log(result.err?.details);
}
```

## Schema Validation & Pre-compilation

Pre-validate and compile schemas at startup for better runtime performance:

```typescript
const validator = ZSchema.create();

const schemas = [
  {
    id: 'person',
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer', minimum: 0 },
    },
    required: ['name'],
  },
  {
    id: 'team',
    type: 'object',
    properties: {
      members: { type: 'array', items: { $ref: 'person' } },
    },
  },
];

// Compile + validate all schemas (resolves cross-references)
try {
  validator.validateSchema(schemas);
} catch (err) {
  console.log('Schema validation failed:', err.details);
}

// Now validate data using the compiled schema ID
validator.validate({ name: 'Alice', age: 30 }, 'person');
```

## Error Handling

`ValidateError` (thrown or returned) has:

- `.name` — `'z-schema validation error'`
- `.message` — summary string
- `.details` — array of `SchemaErrorDetail`:

```typescript
interface SchemaErrorDetail {
  message: string; // "Expected type string but found type number"
  code: string; // "INVALID_TYPE"
  params: (string | number | Array<string | number>)[]; // ["string", "number"]
  path: string | Array<string | number>; // "#/age" or ["age"]
  schemaPath?: Array<string | number>; // ["properties", "age", "type"]
  title?: string; // schema title if present
  description?: string; // schema description if present
  inner?: SchemaErrorDetail[]; // sub-errors for anyOf/oneOf/not
  schemaId?: string; // schema id if present
  keyword?: string; // schema keyword that caused the error (e.g. "required", "type")
}
```

### Error Codes

Common error codes (defined in `src/errors.ts`):

| Code                               | Meaning                                           |
| ---------------------------------- | ------------------------------------------------- |
| `INVALID_TYPE`                     | Value type does not match schema `type`           |
| `INVALID_FORMAT`                   | Value fails format validation                     |
| `ENUM_MISMATCH`                    | Value not in `enum` list                          |
| `ANY_OF_MISSING`                   | No schema in `anyOf` matched                      |
| `ONE_OF_MISSING`                   | No schema in `oneOf` matched                      |
| `ONE_OF_MULTIPLE`                  | Multiple schemas in `oneOf` matched               |
| `NOT_PASSED`                       | Data matched `not` schema                         |
| `OBJECT_MISSING_REQUIRED_PROPERTY` | Missing required property                         |
| `OBJECT_ADDITIONAL_PROPERTIES`     | Extra property not allowed                        |
| `ARRAY_LENGTH_SHORT`               | Array below `minItems`                            |
| `ARRAY_LENGTH_LONG`                | Array above `maxItems`                            |
| `MINIMUM` / `MAXIMUM`              | Number out of range                               |
| `MIN_LENGTH` / `MAX_LENGTH`        | String length out of range                        |
| `PATTERN`                          | String does not match `pattern`                   |
| `UNRESOLVABLE_REFERENCE`           | `$ref` could not be resolved                      |
| `CONST`                            | Value does not match `const` (draft-06+)          |
| `CONTAINS`                         | Array has no item matching `contains` (draft-06+) |
| `PROPERTY_NAMES`                   | Property name fails `propertyNames` (draft-06+)   |
| `ARRAY_UNEVALUATED_ITEMS`          | Unevaluated items not allowed (draft-2019-09+)    |
| `OBJECT_UNEVALUATED_PROPERTIES`    | Unevaluated property not allowed (draft-2019-09+) |

### Filtering Errors

Use `ValidateOptions` to include or exclude specific error codes:

```typescript
// Only report type errors
validator.validate(data, schema, { includeErrors: ['INVALID_TYPE'] });

// Suppress minimum-length errors
validator.validate(data, schema, { excludeErrors: ['MIN_LENGTH'] });
```

### Validating Sub-schemas

Target a specific path within a schema:

```typescript
validator.validate(data, schema, { schemaPath: '#/properties/address' });
```

## Remote References

> **Important:** Static remote references (`ZSchema.setRemoteReference`) are stored in a **global cache shared across all `ZSchema` instances** in the same process. This is intentional — it allows meta-schemas and common references to be registered once and reused everywhere. However, you must not register conflicting schemas under the same URI from different parts of your application, as the last write wins silently. Instance-level references (`validator.setRemoteReference`) are scoped to that instance and take precedence over global ones.

### Manual

```typescript
// Set a remote reference before validation
ZSchema.setRemoteReference('http://example.com/schemas/address.json', addressSchema);

// Or on an instance
validator.setRemoteReference('http://example.com/schemas/person.json', personSchema);
```

### Automatic (Schema Reader)

Set a sync function that loads schemas on demand when a `$ref` is encountered:

```typescript
import fs from 'node:fs';
import path from 'node:path';

ZSchema.setSchemaReader((uri) => {
  const filePath = path.resolve(__dirname, 'schemas', uri + '.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
});
```

### Diagnosing Missing References

```typescript
const { valid, err } = validator.validateSafe(data, schema);
if (!valid && err) {
  const missing = validator.getMissingReferences(err); // all unresolved $refs
  const remote = validator.getMissingRemoteReferences(err); // only remote URIs
  // Fetch and register missing schemas, then retry
}
```

## Custom Format Validators

### Global (shared across all instances)

```typescript
ZSchema.registerFormat('my-format', (value) => {
  if (typeof value !== 'string') return true; // skip non-strings
  return /^[A-Z]{3}-\d{4}$/.test(value);
});
```

### Instance-scoped

```typescript
const validator = ZSchema.create();
validator.registerFormat('my-format', (value) => {
  /* ... */
});
```

### Async Format Validators

Return a `Promise<boolean>`. Requires using async validation mode.

```typescript
validator.registerFormat('user-exists', async (value) => {
  if (typeof value !== 'number') return false;
  const user = await db.findUser(value);
  return user != null;
});

const asyncValidator = ZSchema.create({ async: true });
await asyncValidator.validate(data, schema);
```

### Via Options (at creation time)

```typescript
const validator = ZSchema.create({
  customFormats: {
    'my-format': (value) => typeof value === 'string' && value.length > 0,
  },
});
```

## Draft Version Comparison

| Feature                 | Draft-04                    | Draft-06                                   | Draft-07                            | Draft-2019-09                      | Draft-2020-12 (latest)                  |
| ----------------------- | --------------------------- | ------------------------------------------ | ----------------------------------- | ---------------------------------- | --------------------------------------- |
| Schema ID               | `id`                        | `$id`                                      | `$id`                               | `$id`, `$anchor`                   | `$id`, `$anchor`                        |
| Exclusive min/max       | `exclusiveMinimum: boolean` | `exclusiveMinimum: number`                 | `exclusiveMinimum: number`          | `exclusiveMinimum: number`         | `exclusiveMinimum: number`              |
| `const`                 | N/A                         | Supported                                  | Supported                           | Supported                          | Supported                               |
| `contains`              | N/A                         | Supported                                  | Supported                           | + `minContains`/`maxContains`      | + `minContains`/`maxContains`           |
| `propertyNames`         | N/A                         | Supported                                  | Supported                           | Supported                          | Supported                               |
| `if`/`then`/`else`      | N/A                         | N/A                                        | Supported                           | Supported                          | Supported                               |
| `$defs`                 | N/A                         | N/A                                        | N/A                                 | Supported                          | Supported                               |
| `dependentRequired`     | N/A                         | N/A                                        | N/A                                 | Supported                          | Supported                               |
| `dependentSchemas`      | N/A                         | N/A                                        | N/A                                 | Supported                          | Supported                               |
| `unevaluatedItems`      | N/A                         | N/A                                        | N/A                                 | Supported                          | Supported                               |
| `unevaluatedProperties` | N/A                         | N/A                                        | N/A                                 | Supported                          | Supported                               |
| `prefixItems`           | N/A                         | N/A                                        | N/A                                 | N/A                                | Supported (replaces array-form `items`) |
| `$dynamicRef`           | N/A                         | N/A                                        | N/A                                 | `$recursiveRef`/`$recursiveAnchor` | `$dynamicRef`/`$dynamicAnchor`          |
| Boolean schemas         | N/A                         | `true` (accept all) / `false` (reject all) | Supported                           | Supported                          | Supported                               |
| Default version         | —                           | —                                          | **Default** (`version: 'draft-07'`) | —                                  | —                                       |

To use a specific version:

```typescript
const validator = ZSchema.create({ version: 'draft2020-12' });
```

## Browser Usage (UMD)

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

## CLI

```bash
npm install -g z-schema

# Validate a schema
z-schema mySchema.json

# Validate JSON against a schema
z-schema mySchema.json myData.json

# With strict mode
z-schema --strictMode mySchema.json myData.json
```

## TypeScript Types

All types are exported from the package:

```typescript
import type {
  JsonSchema, // Schema type (all supported drafts union)
  JsonSchemaType, // 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null'
  ZSchemaOptions, // Configuration options
  ValidateOptions, // Per-call options (schemaPath, includeErrors, excludeErrors)
  ValidateResponse, // { valid: boolean, err?: ValidateError }
  SchemaErrorDetail, // Individual error detail
  ErrorCode, // keyof typeof Errors
  FormatValidatorFn, // (input: unknown) => boolean | Promise<boolean>
  SchemaReader, // (uri: string) => JsonSchema
} from 'z-schema';

import { ValidateError } from 'z-schema';
```

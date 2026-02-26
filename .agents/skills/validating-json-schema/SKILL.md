---
name: validating-json-schema
description: Validates JSON data against JSON Schema using z-schema. Use when the user needs to validate JSON, define schemas, handle validation errors, use custom formats, or work with JSON Schema drafts 04 through 2020-12. Covers sync/async modes, safe error handling, schema compilation, remote references, unevaluatedProperties/unevaluatedItems, and TypeScript types.
metadata:
  author: zaggino
  version: '12.0'
---

# Validating JSON with z-schema

z-schema is a JSON Schema validator supporting draft-04, draft-06, draft-07, draft-2019-09, and draft-2020-12 (default).

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

// Throws ValidateError on failure
validator.validate({ name: 'Alice', age: 30 }, schema);
```

## Creating a validator

Always use `ZSchema.create()` — never `new ZSchema()`.

```typescript
// Default (sync, throws on error)
const validator = ZSchema.create();

// Safe mode (returns { valid, err? } instead of throwing)
const safe = ZSchema.create({ safe: true });

// Async (required for async format validators)
const async = ZSchema.create({ async: true });

// Async + safe
const asyncSafe = ZSchema.create({ async: true, safe: true });
```

### Common options

```typescript
const validator = ZSchema.create({
  version: 'draft2020-12', // 'draft-04' | 'draft-06' | 'draft-07' | 'draft2019-09' | 'draft2020-12' | 'none'
  breakOnFirstError: false, // stop at first error
  noEmptyStrings: true, // reject "" for type 'string'
  noEmptyArrays: true, // reject [] for type 'array'
  formatAssertions: null, // null=always assert, true=respect vocabulary, false=annotation-only
  ignoreUnresolvableReferences: false,
});
```

For the full options list, see [references/options.md](references/options.md).

## Validation patterns

### Sync (throws)

```typescript
try {
  validator.validate(data, schema);
} catch (err) {
  console.log(err.details); // SchemaErrorDetail[]
}
```

### Safe (returns result)

```typescript
const { valid, err } = validator.validateSafe(data, schema);
if (!valid) {
  console.log(err?.details);
}
```

### Async

```typescript
const asyncValidator = ZSchema.create({ async: true });
try {
  await asyncValidator.validate(data, schema);
} catch (err) {
  console.log(err.details);
}
```

### Validate sub-schema

```typescript
validator.validate(data, schema, { schemaPath: '#/properties/address' });
```

### Filter errors

```typescript
// Only report type errors
validator.validate(data, schema, { includeErrors: ['INVALID_TYPE'] });

// Suppress specific errors
validator.validate(data, schema, { excludeErrors: ['MIN_LENGTH'] });
```

## Schema compilation

Pre-compile schemas for better performance and cross-references:

```typescript
const schemas = [
  { id: 'person', type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  { id: 'team', type: 'object', properties: { members: { type: 'array', items: { $ref: 'person' } } } },
];

validator.validateSchema(schemas); // compile all
validator.validate({ name: 'Alice' }, 'person'); // validate by ID
```

## Error handling

`ValidateError` has `.details` — an array of `SchemaErrorDetail`:

```typescript
interface SchemaErrorDetail {
  message: string; // "Expected type string but found type number"
  code: string; // "INVALID_TYPE"
  params: unknown[]; // ["string", "number"]
  path: string; // "#/age"
  keyword?: string; // "type"
  inner?: SchemaErrorDetail[]; // sub-errors for anyOf/oneOf/not
}
```

Common error codes: `INVALID_TYPE`, `ENUM_MISMATCH`, `ANY_OF_MISSING`, `ONE_OF_MISSING`, `OBJECT_MISSING_REQUIRED_PROPERTY`, `OBJECT_ADDITIONAL_PROPERTIES`, `PATTERN`, `MINIMUM`, `MAXIMUM`, `MIN_LENGTH`, `MAX_LENGTH`, `CONST`, `CONTAINS`.

See [references/error-codes.md](references/error-codes.md) for the full list.

## Remote references

```typescript
// Manual
ZSchema.setRemoteReference('http://example.com/schemas/address.json', addressSchema);

// Automatic (schema reader)
ZSchema.setSchemaReader((uri) => {
  return JSON.parse(fs.readFileSync(path.resolve('schemas', uri + '.json'), 'utf8'));
});

// Diagnose missing refs
const { valid, err } = validator.validateSafe(data, schema);
if (!valid) {
  const missing = validator.getMissingRemoteReferences(err!);
}
```

## Custom format validators

```typescript
// Global
ZSchema.registerFormat('my-format', (value) => /^[A-Z]{3}-\d{4}$/.test(String(value)));

// Instance-scoped
validator.registerFormat('my-format', (value) => /* ... */);

// Async (requires async validator)
validator.registerFormat('user-exists', async (value) => {
  const user = await db.findUser(value);
  return user != null;
});

// Via options
const v = ZSchema.create({ customFormats: { 'my-format': (val) => typeof val === 'string' } });
```

## Draft-specific features

### Draft-2020-12 (default)

- `prefixItems` for tuples, `items` for remaining items
- `$dynamicRef` / `$dynamicAnchor`
- `unevaluatedProperties` / `unevaluatedItems` with full annotation tracking

### Draft-2019-09

- `$recursiveRef` / `$recursiveAnchor`
- `$anchor`, `$defs`, `dependentRequired`, `dependentSchemas`
- `maxContains` / `minContains`
- `unevaluatedProperties` / `unevaluatedItems`

### Draft-07

- `if` / `then` / `else`

### Draft-06

- `$id`, `const`, `contains`, `propertyNames`, boolean schemas

### Selecting a version

```typescript
const validator = ZSchema.create({ version: 'draft-07' });
```

## TypeScript types

```typescript
import type {
  JsonSchema, // schema type (all drafts union)
  ZSchemaOptions, // configuration
  ValidateOptions, // per-call options
  ValidateResponse, // { valid, err? }
  SchemaErrorDetail, // error detail
  ErrorCode, // error code keys
  FormatValidatorFn, // format validator signature
  SchemaReader, // schema reader function
} from 'z-schema';
import { ValidateError } from 'z-schema';
```

## Browser usage

```html
<script src="node_modules/z-schema/umd/ZSchema.min.js"></script>
<script>
  var validator = ZSchema.create();
  validator.validate({ name: 'test' }, { type: 'object' });
</script>
```

## CLI

```bash
z-schema mySchema.json              # validate a schema
z-schema mySchema.json myData.json  # validate data against schema
```

## Key constraints

- Always use `ZSchema.create()`, never `new ZSchema()`
- Default draft is `draft2020-12`
- Async format validators require `{ async: true }`
- `formatAssertions: null` (default) always enforces format; set `true` to respect vocabulary (annotation-only for modern drafts)
- `unevaluatedProperties` / `unevaluatedItems` track annotations across `allOf`, `anyOf`, `oneOf`, `if/then/else`, `$ref`, `dependentSchemas`, `contains`, and dynamic references

---
name: handling-validation-errors
description: Inspects, filters, and maps z-schema validation errors for application use. Use when the user needs to handle validation errors, walk nested inner errors from anyOf/oneOf/not combinators, map error codes to user-friendly messages, filter errors with includeErrors or excludeErrors, build form-field error mappers, use reportPathAsArray, interpret SchemaErrorDetail fields like code/path/keyword/inner, or debug why validation failed.
---

# Handling Validation Errors in z-schema

z-schema reports validation errors as `ValidateError` objects containing a `.details` array of `SchemaErrorDetail`. This skill covers inspecting, filtering, mapping, and presenting these errors.

## Error structure

```typescript
import { ValidateError } from 'z-schema';
import type { SchemaErrorDetail } from 'z-schema';
```

`ValidateError` extends `Error`:

| Property   | Type                  | Description                          |
| ---------- | --------------------- | ------------------------------------ |
| `.name`    | `string`              | Always `'z-schema validation error'` |
| `.message` | `string`              | Summary message                      |
| `.details` | `SchemaErrorDetail[]` | All individual errors                |

Each `SchemaErrorDetail`:

| Field         | Type                                | Description                                                              |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `message`     | `string`                            | Human-readable text, e.g. `"Expected type string but found type number"` |
| `code`        | `string`                            | Machine-readable code, e.g. `"INVALID_TYPE"`                             |
| `params`      | `(string \| number \| Array)[]`     | Values filling the message template placeholders                         |
| `path`        | `string \| Array<string \| number>` | JSON Pointer to the failing value (`"#/age"` or `["age"]`)               |
| `keyword`     | `string?`                           | Schema keyword that caused the error (`"type"`, `"required"`, etc.)      |
| `inner`       | `SchemaErrorDetail[]?`              | Sub-errors from combinators (`anyOf`, `oneOf`, `not`)                    |
| `schemaPath`  | `Array<string \| number>?`          | Path within the schema to the constraint                                 |
| `schemaId`    | `string?`                           | Schema ID if present                                                     |
| `title`       | `string?`                           | Schema `title` if present                                                |
| `description` | `string?`                           | Schema `description` if present                                          |

## Capturing errors

### Try/catch (default mode)

```typescript
import ZSchema from 'z-schema';

const validator = ZSchema.create();

try {
  validator.validate(data, schema);
} catch (err) {
  if (err instanceof ValidateError) {
    for (const detail of err.details) {
      console.log(`[${detail.code}] ${detail.path}: ${detail.message}`);
    }
  }
}
```

### Safe mode (no try/catch)

```typescript
const validator = ZSchema.create();
const { valid, err } = validator.validateSafe(data, schema);

if (!valid && err) {
  for (const detail of err.details) {
    console.log(`[${detail.code}] ${detail.path}: ${detail.message}`);
  }
}
```

## Walking nested errors

Combinators (`anyOf`, `oneOf`, `not`) produce nested `inner` errors. A recursive walker handles any depth:

```typescript
function walkErrors(details: SchemaErrorDetail[], depth = 0): void {
  for (const detail of details) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}[${detail.code}] ${detail.path}: ${detail.message}`);
    if (detail.inner) {
      walkErrors(detail.inner, depth + 1);
    }
  }
}

const { valid, err } = validator.validateSafe(data, schema);
if (!valid && err) {
  walkErrors(err.details);
}
```

### Collecting all leaf errors

Flatten the tree to get every concrete error, skipping combinator wrappers:

```typescript
function collectLeafErrors(details: SchemaErrorDetail[]): SchemaErrorDetail[] {
  const leaves: SchemaErrorDetail[] = [];
  for (const detail of details) {
    if (detail.inner && detail.inner.length > 0) {
      leaves.push(...collectLeafErrors(detail.inner));
    } else {
      leaves.push(detail);
    }
  }
  return leaves;
}
```

## Mapping errors to form fields

Convert JSON Pointer paths to field names for UI form validation:

```typescript
function pathToFieldName(path: string | Array<string | number>): string {
  if (Array.isArray(path)) {
    return path.join('.');
  }
  // JSON Pointer string: "#/address/city" → "address.city"
  return path.replace(/^#\/?/, '').replace(/\//g, '.');
}

function errorsToFieldMap(details: SchemaErrorDetail[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const leaves = collectLeafErrors(details);
  for (const detail of leaves) {
    const field = pathToFieldName(detail.path) || '_root';
    (map[field] ??= []).push(detail.message);
  }
  return map;
}

// Usage
const { valid, err } = validator.validateSafe(formData, schema);
if (!valid && err) {
  const fieldErrors = errorsToFieldMap(err.details);
  // { "email": ["Expected type string but found type number"],
  //   "age": ["Value 150 is greater than maximum 120"] }
}
```

### Using array paths

Enable `reportPathAsArray` for easier programmatic access:

```typescript
const validator = ZSchema.create({ reportPathAsArray: true });
const { valid, err } = validator.validateSafe(data, schema);
// err.details[0].path → ["address", "city"] instead of "#/address/city"
```

## Filtering errors

### Per-call filtering

Pass `includeErrors` or `excludeErrors` as the third argument:

```typescript
// Only report type mismatches
validator.validate(data, schema, { includeErrors: ['INVALID_TYPE'] });

// Suppress string-length errors
validator.validate(data, schema, { excludeErrors: ['MIN_LENGTH', 'MAX_LENGTH'] });
```

### Programmatic post-filtering

```typescript
const { valid, err } = validator.validateSafe(data, schema);
if (!valid && err) {
  const typeErrors = err.details.filter((d) => d.code === 'INVALID_TYPE');
  const requiredErrors = err.details.filter((d) => d.code === 'OBJECT_MISSING_REQUIRED_PROPERTY');
}
```

## Custom error messages

Map error codes to user-friendly messages:

```typescript
const friendlyMessages: Record<string, (detail: SchemaErrorDetail) => string> = {
  INVALID_TYPE: (d) => `${pathToFieldName(d.path)} must be a ${d.params[0]}`,
  OBJECT_MISSING_REQUIRED_PROPERTY: (d) => `${d.params[0]} is required`,
  MINIMUM: (d) => `${pathToFieldName(d.path)} must be at least ${d.params[1]}`,
  MAXIMUM: (d) => `${pathToFieldName(d.path)} must be at most ${d.params[1]}`,
  MIN_LENGTH: (d) => `${pathToFieldName(d.path)} must be at least ${d.params[1]} characters`,
  MAX_LENGTH: (d) => `${pathToFieldName(d.path)} must be at most ${d.params[1]} characters`,
  PATTERN: (d) => `${pathToFieldName(d.path)} has an invalid format`,
  ENUM_MISMATCH: (d) => `${pathToFieldName(d.path)} must be one of the allowed values`,
  INVALID_FORMAT: (d) => `${pathToFieldName(d.path)} is not a valid ${d.params[0]}`,
};

function toFriendlyMessage(detail: SchemaErrorDetail): string {
  const fn = friendlyMessages[detail.code];
  return fn ? fn(detail) : detail.message;
}
```

## Stopping at first error

For fail-fast scenarios:

```typescript
const validator = ZSchema.create({ breakOnFirstError: true });
```

This reports only the first error encountered, reducing noise during iterative fixing.

## Using the keyword field

The `keyword` field tells you which schema keyword triggered the error — useful for categorizing errors programmatically:

```typescript
const { valid, err } = validator.validateSafe(data, schema);
if (!valid && err) {
  for (const detail of err.details) {
    switch (detail.keyword) {
      case 'required':
        // handle missing field
        break;
      case 'type':
        // handle type mismatch
        break;
      case 'format':
        // handle format failure
        break;
    }
  }
}
```

## Reference files

For the full error code list with descriptions, see the validating-json-data skill's [error-codes reference](../validating-json-data/references/error-codes.md).

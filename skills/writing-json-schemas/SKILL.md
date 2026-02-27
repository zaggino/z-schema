---
name: writing-json-schemas
description: Authors JSON Schema definitions for use with z-schema validation. Use when the user needs to write a JSON Schema, define a schema for an API payload, create schemas for form validation, structure schemas with $ref and $defs, choose between oneOf/anyOf/if-then-else, design object schemas with required and additionalProperties, validate arrays with items or prefixItems, add format constraints, organize schemas for reuse, or write draft-2020-12 schemas.
---

# Writing JSON Schemas for z-schema

Write correct, idiomatic JSON Schemas validated by z-schema. Default target: **draft-2020-12**.

## Schema template

Start every schema with a `$schema` declaration and `type`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "required": [],
  "additionalProperties": false
}
```

Set `additionalProperties: false` explicitly when extra properties should be rejected — z-schema allows them by default.

## Object schemas

### Basic object with required fields

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "email": { "type": "string", "format": "email" },
    "age": { "type": "integer", "minimum": 0, "maximum": 150 }
  },
  "required": ["name", "email"],
  "additionalProperties": false
}
```

### Nested objects

```json
{
  "type": "object",
  "properties": {
    "address": {
      "type": "object",
      "properties": {
        "street": { "type": "string" },
        "city": { "type": "string" },
        "zip": { "type": "string", "pattern": "^\\d{5}(-\\d{4})?$" }
      },
      "required": ["street", "city"]
    }
  }
}
```

### Dynamic property names

Use `patternProperties` to validate property keys by regex:

```json
{
  "type": "object",
  "patternProperties": {
    "^x-": { "type": "string" }
  },
  "additionalProperties": false
}
```

Use `propertyNames` (draft-06+) to constrain all property key strings:

```json
{
  "type": "object",
  "propertyNames": { "pattern": "^[a-z_]+$" }
}
```

## Array schemas

### Uniform array

```json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "uniqueItems": true
}
```

### Tuple validation (draft-2020-12)

Use `prefixItems` for positional types, `items` for remaining elements:

```json
{
  "type": "array",
  "prefixItems": [{ "type": "string" }, { "type": "integer" }],
  "items": false
}
```

`items: false` rejects extra elements beyond the tuple positions.

### Contains (draft-06+)

Require at least one matching item:

```json
{
  "type": "array",
  "contains": { "type": "string", "const": "admin" }
}
```

With count constraints (draft-2019-09+):

```json
{
  "type": "array",
  "contains": { "type": "integer", "minimum": 10 },
  "minContains": 2,
  "maxContains": 5
}
```

## String constraints

```json
{
  "type": "string",
  "minLength": 1,
  "maxLength": 255,
  "pattern": "^[A-Za-z0-9_]+$"
}
```

### Format validation

z-schema has built-in format validators: `date`, `date-time`, `time`, `email`, `idn-email`, `hostname`, `idn-hostname`, `ipv4`, `ipv6`, `uri`, `uri-reference`, `uri-template`, `iri`, `iri-reference`, `json-pointer`, `relative-json-pointer`, `regex`, `duration`, `uuid`.

```json
{ "type": "string", "format": "date-time" }
```

Format assertions are always enforced by default (`formatAssertions: null`). For vocabulary-aware behavior in draft-2020-12, set `formatAssertions: true` on the validator.

## Numeric constraints

```json
{
  "type": "number",
  "minimum": 0,
  "maximum": 100,
  "multipleOf": 0.01
}
```

Use `exclusiveMinimum` / `exclusiveMaximum` for strict bounds:

```json
{ "type": "integer", "exclusiveMinimum": 0, "exclusiveMaximum": 100 }
```

## Combinators

### `anyOf` — match at least one

```json
{
  "anyOf": [{ "type": "string" }, { "type": "number" }]
}
```

### `oneOf` — match exactly one

```json
{
  "oneOf": [
    { "type": "string", "maxLength": 5 },
    { "type": "string", "minLength": 10 }
  ]
}
```

### `allOf` — match all

Use for schema composition. Combine base schemas with refinements:

```json
{
  "allOf": [{ "$ref": "#/$defs/base" }, { "properties": { "extra": { "type": "string" } } }]
}
```

### `not` — must not match

```json
{ "not": { "type": "null" } }
```

### `if` / `then` / `else` (draft-07+)

Conditional validation — prefer over complex `oneOf` when the logic is "if X then require Y":

```json
{
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["personal", "business"] },
    "company": { "type": "string" }
  },
  "if": { "properties": { "type": { "const": "business" } } },
  "then": { "required": ["company"] },
  "else": {}
}
```

### When to use which combinator

| Scenario                           | Use                |
| ---------------------------------- | ------------------ |
| Value can be multiple types        | `anyOf`            |
| Exactly one variant must match     | `oneOf`            |
| Compose inherited schemas          | `allOf`            |
| "if condition then require fields" | `if`/`then`/`else` |
| Exclude a specific shape           | `not`              |

Prefer `if`/`then`/`else` over `oneOf` when the condition is a single discriminator field — it produces clearer error messages.

## Schema reuse with `$ref` and `$defs`

### Local definitions

```json
{
  "$defs": {
    "address": {
      "type": "object",
      "properties": {
        "street": { "type": "string" },
        "city": { "type": "string" }
      },
      "required": ["street", "city"]
    }
  },
  "type": "object",
  "properties": {
    "home": { "$ref": "#/$defs/address" },
    "work": { "$ref": "#/$defs/address" }
  }
}
```

### Cross-schema references

Compile an array of schemas and reference by ID:

```typescript
import ZSchema from 'z-schema';

const schemas = [
  {
    $id: 'address',
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  },
  {
    $id: 'person',
    type: 'object',
    properties: {
      name: { type: 'string' },
      home: { $ref: 'address' },
    },
    required: ['name'],
  },
];

const validator = ZSchema.create();
validator.validateSchema(schemas);
validator.validate({ name: 'Alice', home: { city: 'Paris' } }, 'person');
```

## Strict schemas with `unevaluatedProperties` (draft-2019-09+)

When combining schemas with `allOf`, `additionalProperties: false` in a sub-schema blocks properties defined in sibling schemas. Use `unevaluatedProperties` instead — it tracks all properties evaluated across applicators:

```json
{
  "allOf": [
    {
      "type": "object",
      "properties": { "name": { "type": "string" } },
      "required": ["name"]
    },
    {
      "type": "object",
      "properties": { "age": { "type": "integer" } }
    }
  ],
  "unevaluatedProperties": false
}
```

This accepts `{ "name": "Alice", "age": 30 }` but rejects `{ "name": "Alice", "age": 30, "extra": true }`.

## Validating the schema itself

Always validate schemas at startup:

```typescript
const validator = ZSchema.create();
try {
  validator.validateSchema(schema);
} catch (err) {
  console.log('Schema errors:', err.details);
}
```

## Common mistakes

- **Forgetting `additionalProperties`**: By default, extra properties are allowed. Set `additionalProperties: false` or use `unevaluatedProperties: false` to reject them.
- **Using `additionalProperties: false` with `allOf`**: This blocks properties from sibling schemas. Use `unevaluatedProperties: false` at the top level instead (draft-2019-09+).
- **Array `items` in draft-2020-12**: Use `prefixItems` for tuple validation. `items` now means "schema for remaining items".
- **Missing `$schema`**: Without it, z-schema uses its configured default draft. Include `$schema` for explicit draft targeting.
- **`definitions` vs `$defs`**: Both work, but `$defs` is the canonical form in draft-2019-09+. Use it consistently.

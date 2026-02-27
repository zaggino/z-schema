---
name: migrating-json-schemas
description: Migrates JSON Schemas between draft versions for use with z-schema. Use when the user wants to upgrade schemas from draft-04 to draft-2020-12, convert between draft formats, update deprecated keywords, replace id with $id, convert definitions to $defs, migrate items to prefixItems, replace dependencies with dependentRequired or dependentSchemas, adopt unevaluatedProperties or unevaluatedItems, or adapt schemas to newer JSON Schema features.
---

# Migrating JSON Schemas Between Drafts

z-schema supports draft-04, draft-06, draft-07, draft-2019-09, and draft-2020-12. This skill covers migrating schemas between drafts and verifying them with z-schema.

## Migration workflow

1. Identify the source draft (check `$schema` or `id`/`$id` usage).
2. Set the target version on the validator:
   ```typescript
   import ZSchema from 'z-schema';
   const validator = ZSchema.create({ version: 'draft2020-12' });
   ```
3. Run `validator.validateSchema(schema)` to surface incompatibilities.
4. Fix each reported error using the keyword mapping below.
5. Re-validate until the schema passes.

## Quick reference: keyword changes

| Old keyword (draft-04)               | New keyword (draft-2020-12)          | Introduced in |
| ------------------------------------ | ------------------------------------ | ------------- |
| `id`                                 | `$id`                                | draft-06      |
| `definitions`                        | `$defs`                              | draft-2019-09 |
| Array-form `items` (tuple)           | `prefixItems`                        | draft-2020-12 |
| `additionalItems`                    | `items` (when `prefixItems` present) | draft-2020-12 |
| `exclusiveMinimum: true` (boolean)   | `exclusiveMinimum: <number>`         | draft-06      |
| `exclusiveMaximum: true` (boolean)   | `exclusiveMaximum: <number>`         | draft-06      |
| `dependencies` (string arrays)       | `dependentRequired`                  | draft-2019-09 |
| `dependencies` (schema values)       | `dependentSchemas`                   | draft-2019-09 |
| `$recursiveRef` / `$recursiveAnchor` | `$dynamicRef` / `$dynamicAnchor`     | draft-2020-12 |

For the complete keyword mapping with examples, see [references/keyword-mapping.md](references/keyword-mapping.md).

## Common migration paths

### Draft-04 → Draft-2020-12

This is the largest jump. Apply changes in order:

**1. Rename `id` to `$id`**

```json
// Before (draft-04)
{ "id": "http://example.com/person.json", "type": "object" }

// After (draft-2020-12)
{ "$id": "http://example.com/person.json", "type": "object" }
```

**2. Convert boolean `exclusiveMinimum`/`exclusiveMaximum` to numeric**

```json
// Before (draft-04)
{ "type": "number", "minimum": 0, "exclusiveMinimum": true }

// After (draft-2020-12)
{ "type": "number", "exclusiveMinimum": 0 }
```

Note: the `minimum` keyword is removed when converting to `exclusiveMinimum` as a number, since `exclusiveMinimum: 0` means "greater than 0".

**3. Rename `definitions` to `$defs`**

```json
// Before
{ "definitions": { "address": { "type": "object" } } }

// After
{ "$defs": { "address": { "type": "object" } } }
```

Update all `$ref` values that point to `#/definitions/...` → `#/$defs/...`.

**4. Split `dependencies`**

```json
// Before (draft-04) — mixed dependencies
{
  "dependencies": {
    "billing_address": ["credit_card"],
    "credit_card": { "type": "object", "properties": { "cvv": { "type": "string" } } }
  }
}

// After (draft-2020-12) — split into two keywords
{
  "dependentRequired": {
    "billing_address": ["credit_card"]
  },
  "dependentSchemas": {
    "credit_card": { "type": "object", "properties": { "cvv": { "type": "string" } } }
  }
}
```

**5. Convert tuple `items` to `prefixItems`**

```json
// Before (draft-04)
{
  "type": "array",
  "items": [{ "type": "string" }, { "type": "number" }],
  "additionalItems": false
}

// After (draft-2020-12)
{
  "type": "array",
  "prefixItems": [{ "type": "string" }, { "type": "number" }],
  "items": false
}
```

When `items` was an array (tuple validation), it becomes `prefixItems`. The old `additionalItems` becomes `items`.

**6. Add `$schema` declaration**

```json
{ "$schema": "https://json-schema.org/draft/2020-12/schema" }
```

### Draft-07 → Draft-2020-12

Smaller jump. Main changes:

1. `definitions` → `$defs` (and update `$ref` paths)
2. Array-form `items` → `prefixItems`
3. `additionalItems` → `items` (when `prefixItems` present)
4. `dependencies` → `dependentRequired` / `dependentSchemas`
5. Consider adopting `unevaluatedProperties` / `unevaluatedItems` for stricter validation of combined schemas

### Draft-2019-09 → Draft-2020-12

Minimal changes:

1. Array-form `items` → `prefixItems`, `additionalItems` → `items`
2. `$recursiveRef`/`$recursiveAnchor` → `$dynamicRef`/`$dynamicAnchor`

## Verifying a migrated schema

After migration, validate the schema itself against the target draft's meta-schema:

```typescript
import ZSchema from 'z-schema';

const validator = ZSchema.create({ version: 'draft2020-12' });

try {
  validator.validateSchema(migratedSchema);
  console.log('Schema is valid for draft-2020-12');
} catch (err) {
  console.log('Schema issues:', err.details);
}
```

Then test data validation to confirm behavior is unchanged:

```typescript
// Test with known-good data
validator.validate(knownGoodData, migratedSchema);

// Test with known-bad data
const { valid } = validator.validateSafe(knownBadData, migratedSchema);
if (valid) {
  console.warn('Migration issue: previously invalid data now passes');
}
```

## Backward compatibility

If schemas must work across multiple draft versions, use `version: 'none'` and set `$schema` in each schema to declare its own draft:

```typescript
const validator = ZSchema.create({ version: 'none' });
```

## Reference files

- [references/keyword-mapping.md](references/keyword-mapping.md) — Complete keyword mapping across all drafts with before/after examples

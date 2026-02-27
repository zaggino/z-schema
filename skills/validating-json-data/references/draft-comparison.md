# Draft Comparison

Feature availability across JSON Schema drafts supported by z-schema.

## Table of contents

- [Feature matrix](#feature-matrix)
- [Key migration changes](#key-migration-changes)
- [Setting the draft version](#setting-the-draft-version)

---

## Feature matrix

| Feature                              | Draft-04 | Draft-06 | Draft-07 | Draft-2019-09                 | Draft-2020-12                 |
| ------------------------------------ | -------- | -------- | -------- | ----------------------------- | ----------------------------- |
| Schema ID keyword                    | `id`     | `$id`    | `$id`    | `$id`, `$anchor`              | `$id`, `$anchor`              |
| `$ref`                               | Yes      | Yes      | Yes      | Yes                           | Yes                           |
| `definitions`                        | Yes      | Yes      | Yes      | Yes (+ `$defs`)               | Yes (+ `$defs`)               |
| `$defs`                              | —        | —        | —        | Yes                           | Yes                           |
| Boolean schemas (`true`/`false`)     | —        | Yes      | Yes      | Yes                           | Yes                           |
| `const`                              | —        | Yes      | Yes      | Yes                           | Yes                           |
| `contains`                           | —        | Yes      | Yes      | + `minContains`/`maxContains` | + `minContains`/`maxContains` |
| `propertyNames`                      | —        | Yes      | Yes      | Yes                           | Yes                           |
| `exclusiveMinimum` type              | boolean  | number   | number   | number                        | number                        |
| `exclusiveMaximum` type              | boolean  | number   | number   | number                        | number                        |
| `if` / `then` / `else`               | —        | —        | Yes      | Yes                           | Yes                           |
| `dependentRequired`                  | —        | —        | —        | Yes                           | Yes                           |
| `dependentSchemas`                   | —        | —        | —        | Yes                           | Yes                           |
| `unevaluatedProperties`              | —        | —        | —        | Yes                           | Yes                           |
| `unevaluatedItems`                   | —        | —        | —        | Yes                           | Yes                           |
| `prefixItems`                        | —        | —        | —        | —                             | Yes                           |
| Array-form `items` (tuple)           | Yes      | Yes      | Yes      | Yes                           | Replaced by `prefixItems`     |
| `$recursiveRef` / `$recursiveAnchor` | —        | —        | —        | Yes                           | —                             |
| `$dynamicRef` / `$dynamicAnchor`     | —        | —        | —        | —                             | Yes                           |
| `$vocabulary`                        | —        | —        | —        | Yes                           | Yes                           |

## Key migration changes

### Draft-04 → Draft-06

- `id` renamed to `$id`
- `exclusiveMinimum` / `exclusiveMaximum` changed from boolean to number
- Added: `const`, `contains`, `propertyNames`, boolean schemas

### Draft-06 → Draft-07

- Added: `if` / `then` / `else`
- `$comment` keyword for schema annotations

### Draft-07 → Draft-2019-09

- Added: `$defs` (replaces `definitions`), `dependentRequired`, `dependentSchemas`
- Added: `unevaluatedProperties`, `unevaluatedItems`
- Added: `$recursiveRef` / `$recursiveAnchor`
- Added: `$vocabulary` for meta-schema vocabulary declarations
- Added: `minContains` / `maxContains`
- `dependencies` split into `dependentRequired` + `dependentSchemas`

### Draft-2019-09 → Draft-2020-12

- Array-form `items` replaced by `prefixItems`; `items` now means "additional items schema"
- `$recursiveRef`/`$recursiveAnchor` replaced by `$dynamicRef`/`$dynamicAnchor`
- `additionalItems` replaced by `items` (when `prefixItems` is present)

## Setting the draft version

```typescript
import ZSchema from 'z-schema';

// Explicit (recommended when schema targets a specific draft)
const validator = ZSchema.create({ version: 'draft-07' });

// Default (draft-2020-12)
const validator = ZSchema.create();

// Auto-detect from $schema (use 'none' to let each schema declare its own)
const validator = ZSchema.create({ version: 'none' });
```

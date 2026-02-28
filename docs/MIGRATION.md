# Migration Guide

This guide covers breaking changes and upgrade steps for major z-schema releases.

---

## Upgrading to v12

v12 is a major release that makes **draft-2020-12** the default JSON Schema version and adds full support for **draft-2019-09** and **draft-2020-12**.

### Breaking Changes

#### 1. Default schema version is now `draft2020-12`

Previously the default was `draft-07` (v11). If your schemas rely on draft-04/06/07 behavior, set the version explicitly:

```typescript
const validator = ZSchema.create({ version: 'draft-07' });
```

Or declare `$schema` in every schema document:

```json
{ "$schema": "http://json-schema.org/draft-07/schema#" }
```

#### 2. Schema keyword changes in draft-2020-12

If you adopt the new default, some keywords have changed meaning:

| Old (draft-04/06/07)     | New (draft-2020-12)              | Notes                                                            |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------- |
| `id`                     | `$id`                            | `id` still works in draft-04 mode                                |
| `definitions`            | `$defs`                          | `definitions` still works but `$defs` is preferred               |
| `items` (tuple form)     | `prefixItems`                    | `items: [...]` → `prefixItems: [...]`                            |
| `additionalItems`        | `items` (single schema)          | When used with `prefixItems`, `items` replaces `additionalItems` |
| `dependencies` (schemas) | `dependentSchemas`               | Split into `dependentSchemas` + `dependentRequired`              |
| `dependencies` (arrays)  | `dependentRequired`              | See above                                                        |
| —                        | `unevaluatedProperties`          | New in 2019-09                                                   |
| —                        | `unevaluatedItems`               | New in 2020-12                                                   |
| —                        | `$dynamicRef` / `$dynamicAnchor` | Replaces `$recursiveRef` / `$recursiveAnchor`                    |

See [docs/migrating-schemas](../skills/migrating-json-schemas/) for detailed schema migration guidance.

---

## Upgrading to v11

v11 changed the default JSON Schema version to **draft-07**.

### Breaking Changes

#### 1. Default schema version is now `draft-07`

Previously the default was `draft-06` (v10). If your schemas rely on draft-04/06 behavior, set the version explicitly:

```typescript
const validator = ZSchema.create({ version: 'draft-06' });
```

---

## Upgrading to v10

v10 changed the default JSON Schema version to **draft-06**.

### Breaking Changes

#### 1. Default schema version is now `draft-06`

Previously the default was `draft-04` (v8/v9). If your schemas rely on draft-04 behavior, set the version explicitly:

```typescript
const validator = ZSchema.create({ version: 'draft-04' });
```

---

## Upgrading to v9

v9 introduced the factory API and removed direct constructor access.

### Breaking Changes

#### 1. `new ZSchema()` → `ZSchema.create()`

```diff
- const validator = new ZSchema({ strictMode: true });
+ const validator = ZSchema.create({ strictMode: true });
```

#### 2. Four typed class variants

`ZSchema.create()` returns a specifically typed instance based on `async` and `safe` options:

| Options                       | Returns            | `validate()` signature                       |
| ----------------------------- | ------------------ | -------------------------------------------- |
| `{}`                          | `ZSchema`          | `(json, schema) => true` (throws)            |
| `{ safe: true }`              | `ZSchemaSafe`      | `(json, schema) => { valid, err? }`          |
| `{ async: true }`             | `ZSchemaAsync`     | `(json, schema) => Promise<true>`            |
| `{ async: true, safe: true }` | `ZSchemaAsyncSafe` | `(json, schema) => Promise<{ valid, err? }>` |

#### 3. `validate()` throws by default

In earlier versions, `validate()` returned a boolean and errors were retrieved via `getLastErrors()`. In v9+, the default `validate()` throws a `ValidateError` on failure:

```diff
- const valid = validator.validate(data, schema);
- if (!valid) {
-   const errors = validator.getLastErrors();
- }
+ try {
+   validator.validate(data, schema);
+ } catch (error) {
+   console.log(error.details); // array of SchemaErrorDetail
+ }
```

Or use safe mode for a non-throwing API:

```typescript
const validator = ZSchema.create({ safe: true });
const result = validator.validate(data, schema);
if (!result.valid) {
  console.log(result.err!.details);
}
```

#### 4. `getLastError()` / `getLastErrors()` removed

These methods no longer exist. Errors are now returned directly from `validate()` — either thrown as `ValidateError` (default mode) or returned in the `err` field (safe mode).

#### 5. `isValid()` removed

Use `validate()` directly. In safe mode, check `result.valid`.

#### 6. `compileSchema()`, `getMissingReferences()`, `getMissingRemoteReferences()`, `getResolvedSchema()` removed

These utility methods were removed from the public API.

#### 7. `setRemoteReference()` is now static only

The instance method was removed. Use `ZSchema.setRemoteReference()` instead.

#### 8. `validateAsyncSafe()` return type changed

The return type changed from `{ valid, errs? }` to `{ valid, err? }` (singular `err` of type `ValidateError`).

---

## Upgrading to v8

v8 introduced automatic JSON Schema draft version detection.

### Breaking Changes

#### 1. Schemas without `$schema` are treated as draft-04

Previously, schemas missing `$schema` were validated without strict draft semantics. In v8+, `$schema` is automatically set to `http://json-schema.org/draft-04/schema#`. Set `{ version: 'none' }` to opt out:

```typescript
const validator = ZSchema.create({ version: 'none' });
```

#### 2. New `version` option

A new `version` option was added to `ZSchemaOptions`, defaulting to `'draft-04'`. This controls which draft meta-schema is injected when `$schema` is absent.

#### 3. Meta-schemas registered globally

Draft-04 meta-schemas are now registered via `ZSchema.setRemoteReference()` at module load time instead of per-instance in the constructor.

---

## Upgrading to v7

v7 was a complete rewrite of z-schema.

### Breaking Changes

#### 1. TypeScript / ESM source

The library source is now TypeScript compiled to ES modules. A CJS bundle is available at `z-schema/cjs` and a UMD bundle at `z-schema/umd/ZSchema.js`.

#### 2. Node.js >= 22 required

The `engines` field requires Node.js 22 or later. Older Node.js versions are not supported.

#### 3. New entry point

The `main` field was replaced by an `exports` map. Import `z-schema` (ESM), `z-schema/cjs` (CJS), or `z-schema/umd/ZSchema.js` (UMD). Direct deep imports like `z-schema/src/ZSchema` no longer work.

#### 4. Source file renames

All source files were renamed from PascalCase (`ZSchema.js`, `FormatValidators.js`) to kebab-case (`z-schema.ts`, `format-validators.ts`). Any direct submodule imports will break.

---

## Upgrading to v6

v6 dropped support for older Node.js runtimes.

### Breaking Changes

#### 1. Node.js < 16 no longer supported

CI now tests on Node.js 16 and 18 only. Node.js 14 and earlier are no longer tested or supported. If you need Node.js 14 support, pin to `z-schema@5`.

---

## Upgrading to v5

v5 changed a default option value, which may alter validation behavior in existing code.

### Breaking Changes

#### 1. `breakOnFirstError` defaults to `false`

Previously, `breakOnFirstError` defaulted to `true`, meaning validation stopped after the first error. In v5+, all errors are collected by default. If your code depends on only the first error being reported, set the option explicitly:

```javascript
var ZSchema = require('z-schema');
var validator = new ZSchema({ breakOnFirstError: true });
```

#### 2. `validator` dependency downgraded

The `validator` npm package was downgraded from `^13.6.0` to `^12.0.0`. This may affect format validation results for edge-case inputs. The dependency was later bumped back to 13.x in v5.0.1.

---

## Upgrading to v4

v4 dropped support for very old Node.js runtimes.

### Breaking Changes

#### 1. Node.js < 10 no longer supported

CI now tests on Node.js 10, 12, and 14. Node.js 8 and earlier are no longer tested or supported. If you need Node.js 8 support, pin to `z-schema@3`.

---

## Upgrading to v3

v3 was a complete rewrite of z-schema with a new options API and many new features.

### Breaking Changes

#### 1. New options API

The constructor accepts an options object with new strict-mode properties. Previous v2 usage patterns are not compatible.

```javascript
var ZSchema = require('z-schema');
var validator = new ZSchema({
  noEmptyStrings: true,
  noTypeless: true,
  forceItems: true,
  forceProperties: true,
  forceMaxLength: true,
});
```

#### 2. New strict-mode options

The following options were added and default to `false`:

| Option                         | Description                                             |
| ------------------------------ | ------------------------------------------------------- |
| `noEmptyStrings`               | Strings must have `minLength >= 1`                      |
| `noTypeless`                   | Every schema must declare a `type`                      |
| `forceItems`                   | Arrays must define `items`                              |
| `forceProperties`              | Objects must define `properties` or `patternProperties` |
| `forceMaxLength`               | Strings must define `maxLength`                         |
| `noExtraKeywords`              | Reject unrecognized schema keywords                     |
| `noEmptyArrays`                | Arrays must have `minItems >= 1`                        |
| `ignoreUnresolvableReferences` | Suppress `UNRESOLVABLE_REFERENCE` errors                |

### New Features

- Support for multiple linked schemas
- Remote schema downloading
- `breakOnFirstError` option (added in v3.3.0)
- `reportPathAsArray` option for array-based error paths (added in v3.1.0)
- `setSchemaReader()` for pluggable remote schema loading (added in v3.10.0)
- `pedanticCheck` option for strict schema best-practice checks (added in v3.11.0)
- `ignoreUnknownFormats` option (added in v3.13.0)
- `customValidator` option for user-defined validation logic (added in v3.17.0)
- Bundled JSON Schema meta-schemas (added in v3.9.0)

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

---

## Upgrading to v7

v7 was a complete rewrite of z-schema.

### Breaking Changes

#### 1. TypeScript / ESM source

The library source is now TypeScript compiled to ES modules. A CJS bundle is available at `z-schema/cjs` and a UMD bundle at `z-schema/umd/ZSchema.js`.

#### 2. Node.js >= 22 required

The `engines` field requires Node.js 22 or later. Older Node.js versions are not supported.

#### 3. Default schema version is `draft-04`

Schemas without a `$schema` property default to draft-04 validation. Use `{ version: 'none' }` to opt out of automatic version detection.

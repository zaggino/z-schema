# Architecture Details

## Module dependency flow

```
z-schema.ts (factory + public classes)
  └─ z-schema-base.ts (core orchestration)
       ├─ schema-compiler.ts ($ref, $id, compilation)
       │    ├─ schema-cache.ts (URI → schema map)
       │    └─ utils/uri.ts (URI resolution)
       ├─ schema-validator.ts (meta-schema validation)
       │    └─ json-validation.ts (reused for recursive meta-validation)
       ├─ json-validation.ts (validation orchestration)
       │    ├─ validation/type.ts (type, enum, const)
       │    ├─ validation/numeric.ts (multipleOf, min/max)
       │    ├─ validation/string.ts (minLength, maxLength, pattern, format)
       │    ├─ validation/array.ts (items, prefixItems, contains, uniqueItems)
       │    ├─ validation/object.ts (properties, additionalProperties, required)
       │    ├─ validation/combinators.ts (allOf, anyOf, oneOf, not, if/then/else)
       │    ├─ validation/ref.ts ($dynamicRef, $recursiveRef)
       │    ├─ validation/shared.ts (shared types, vocab helpers)
       │    ├─ format-validators.ts (built-in + custom formats)
       │    ├─ report.ts (error accumulation)
       │    └─ utils/* (clone, whatIs, unicode, etc.)
       └─ z-schema-versions.ts (registers bundled meta-schemas)
            └─ schemas/* (generated at build)
```

## Factory pattern

All `ZSchema` class variants are created via static `create()`:

```typescript
const validator = ZSchema.create(options);
const safe = ZSchemaSafe.create(options);
const async = ZSchemaAsync.create(options);
const asyncSafe = ZSchemaAsyncSafe.create(options);
```

Direct `new` is forbidden. The factory enforces proper initialization and option normalization.

## Four class variants

| Class              | `validate()` returns              | Error handling                    |
| ------------------ | --------------------------------- | --------------------------------- |
| `ZSchema`          | `boolean`                         | Throws `ValidateError` on invalid |
| `ZSchemaSafe`      | `{ valid, data?, err? }`          | Never throws                      |
| `ZSchemaAsync`     | `Promise<T>`                      | Rejects with `ValidateError`      |
| `ZSchemaAsyncSafe` | `Promise<{ valid, data?, err? }>` | Never rejects                     |

## Build outputs

| Output | Format             | Entry            |
| ------ | ------------------ | ---------------- |
| `src/` | ESM (source)       | `src/index.ts`   |
| `cjs/` | CommonJS           | `cjs/index.js`   |
| `umd/` | UMD browser global | `umd/ZSchema.js` |

Rollup bundles CJS and UMD from the ESM source. The `package.json` `exports` field maps `import` → `src/index.ts` and `require` → `cjs/index.js`.

## Internal types vs public API

All public types and values go through `src/index.ts`. Internal types stay unexported and may change between versions. Key public exports:

- `ZSchema`, `ZSchemaSafe`, `ZSchemaAsync`, `ZSchemaAsyncSafe` (classes)
- `ValidateError` (error class)
- `Errors` (error code constants)
- `ZSchemaOptions` (options interface)
- `SchemaReader` (remote reader type)
- `SchemaErrorDetail` (error detail shape)
- JSON Schema type definitions per draft

## Schema cache

`schema-cache.ts` maintains a `Map<string, compiled schema>` keyed by normalized URI. Meta-schemas are pre-registered by `z-schema-versions.ts` at import time. User schemas are added during `compileSchema()`.

## Report system

`report.ts` provides the `Report` class that accumulates errors during validation. Each error is a `SchemaErrorDetail` with:

- `code` — Error constant from `Errors`
- `message` — Human-readable message
- `path` — JSON Pointer to the failing data location
- `schemaPath` — JSON Pointer to the failing schema keyword
- `inner` — Nested `SchemaErrorDetail[]` for combiner errors

On validation failure, the report converts to a `ValidateError` with a `.details` array.

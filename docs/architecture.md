# Architecture

## Module Dependency Flow

```
index.ts (public API)
  └─ z-schema.ts (ZSchema, ZSchemaSafe, ZSchemaAsync, ZSchemaAsyncSafe)
       └─ z-schema-base.ts (ZSchemaBase — core validation orchestration)
            ├─ schema-compiler.ts (compile schemas, resolve $ref, collect ids)
            ├─ schema-validator.ts (validate schemas against meta-schemas)
            ├─ json-validation.ts (validate JSON data against compiled schemas)
            ├─ schema-cache.ts (cache schemas by URI and id)
            ├─ report.ts (accumulate validation errors)
            ├─ errors.ts (error codes, ValidateError)
            ├─ format-validators.ts (built-in + custom format validation)
            ├─ json-schema.ts (type definitions, version mappings)
            ├─ z-schema-options.ts (options type + defaults)
            └─ utils/* (clone, json, uri, what-is, etc.)
```

## Factory Pattern

`ZSchema` uses a static factory — **never call `new ZSchema()`**. Use `ZSchema.create(options?)` which returns a typed variant based on options:

| Options                       | Return type        | `validate()` returns       |
| ----------------------------- | ------------------ | -------------------------- |
| `{}` (default)                | `ZSchema`          | `true` (throws on error)   |
| `{ safe: true }`              | `ZSchemaSafe`      | `{ valid, err? }`          |
| `{ async: true }`             | `ZSchemaAsync`     | `Promise<true>`            |
| `{ async: true, safe: true }` | `ZSchemaAsyncSafe` | `Promise<{ valid, err? }>` |

## Validation Pipeline

1. **Schema compilation** (`schema-compiler.ts`): resolves `$ref`, collects `id`/`$id`, validates schema structure.
2. **JSON validation** (`json-validation.ts`): validates a JSON instance against the compiled schema (type checks, constraints, combiners like `allOf`/`anyOf`/`oneOf`/`not`).
3. **Report** (`report.ts`): errors accumulate in a `Report` object, then get converted into a `ValidateError`.

## JSON Schema Version Support

Currently supported: `draft-04` (default), `draft-06`. Set via `ZSchemaOptions.version`.

Draft-06 adds: `$id`, `const`, `contains`, `propertyNames`, `examples`, boolean `exclusiveMinimum`/`exclusiveMaximum` as numbers.

Meta-schemas are bundled in `src/schemas/` (copied from `json-schema-spec/` at build time by `scripts/copy-schemas.mts`).

## Build Outputs

| Output  | Format                         | Entry                        |
| ------- | ------------------------------ | ---------------------------- |
| `dist/` | ESM + types                    | `src/index.ts` via `tsc`     |
| `cjs/`  | CommonJS                       | `src/index.ts` via Rollup    |
| `umd/`  | UMD (browser global `ZSchema`) | `src/z-schema.ts` via Rollup |

The `src/package.json` contains `{ "type": "module" }` and gets copied to `dist/` to mark ESM output.

## Key Internal Types

- `JsonSchema` — union of `JsonSchemaDraft4 | JsonSchemaDraft6`
- `JsonSchemaInternal` — internal schema type with compiler metadata (`__$compiled`, `__$validationOptions`, etc.)
- `ValidateError` — error class thrown/returned on validation failure, contains `.errors` array of `SchemaErrorDetail`
- `ZSchemaOptions` — all validator configuration options

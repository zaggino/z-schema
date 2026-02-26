# Architecture

## Module Dependency Flow

```
index.ts (public API)
  └─ z-schema.ts (ZSchema, ZSchemaSafe, ZSchemaAsync, ZSchemaAsyncSafe)
       ├─ z-schema-versions.ts (register bundled draft-04/draft-06/draft-07/draft-2019-09/draft-2020-12 meta-schemas)
       └─ z-schema-base.ts (ZSchemaBase — core validation orchestration)
            ├─ schema-compiler.ts (compile schemas, resolve $ref, collect ids)
            ├─ schema-validator.ts (validate schemas against meta-schemas)
            ├─ json-validation.ts (validate JSON data against compiled schemas)
            ├─ schema-cache.ts (cache schemas by URI and id)
            ├─ report.ts (accumulate validation errors)
            ├─ errors.ts (error codes, ValidateError)
            ├─ format-validators.ts (built-in + custom format validation)
            ├─ json-schema.ts (shared/common schema definitions + helpers)
            ├─ json-schema-versions.ts (draft-specific schema type unions + version mappings)
            ├─ z-schema-options.ts (options type + defaults)
            └─ utils/
                 ├─ array.ts (array helpers)
                 ├─ clone.ts (deep/shallow clone)
                 ├─ json.ts (JSON path traversal, sortedKeys)
                 ├─ properties.ts (object property copy)
                 ├─ schema-regex.ts (schema-aware regex)
                 ├─ symbols.ts (shared symbols: jsonSymbol, schemaSymbol)
                 ├─ unicode.ts (Unicode-aware string length)
                 ├─ uri.ts (URI parsing, resolution, isAbsoluteUri)
                 └─ what-is.ts (type detection: whatIs, isObject)
```

## Factory Pattern

`ZSchema` uses a static factory — **never call `new ZSchema()`**. Use `ZSchema.create(options?)` which returns a typed variant based on options:

| Options                       | Return type        | `validate()` returns       |
| ----------------------------- | ------------------ | -------------------------- |
| `{}` (default)                | `ZSchema`          | `true` (throws on error)   |
| `{ safe: true }`              | `ZSchemaSafe`      | `{ valid, err? }`          |
| `{ async: true }`             | `ZSchemaAsync`     | `Promise<true>`            |
| `{ async: true, safe: true }` | `ZSchemaAsyncSafe` | `Promise<{ valid, err? }>` |

All variants also expose:

- `validateSchema(schema)` — compile + validate a schema (or array of schemas) against the meta-schema
- `validateSafe(json, schema)` — object-based result (available on `ZSchema`, convenience method)
- `validateAsync(json, schema)` — promise-based (available on `ZSchema`, convenience method)
- `setRemoteReference(uri, schema)` — cache a remote schema by URI (instance method)
- `getResolvedSchema(schemaId)` — get a previously compiled schema with `$ref` resolved
- `getMissingReferences(err)` — extract unresolved `$ref` URIs from a `ValidateError`
- `getMissingRemoteReferences(err)` — extract unresolved remote URIs from a `ValidateError`
- `registerFormat(name, fn)` / `unregisterFormat(name)` — instance-scoped custom format validators
- `getRegisteredFormats()` / `getSupportedFormats()` — list registered/supported format names

Static methods on `ZSchema`:

- `ZSchema.create(options?)` — factory (see table above)
- `ZSchema.registerFormat(name, fn)` / `ZSchema.unregisterFormat(name)` — global format validators
- `ZSchema.getRegisteredFormats()` — list globally registered format names
- `ZSchema.getDefaultOptions()` — get a copy of the default options
- `ZSchema.setRemoteReference(uri, schema)` — cache a remote schema globally
- `ZSchema.setSchemaReader(fn)` — set a sync function to load schemas by URI on demand
- `ZSchema.getSchemaReader()` — get the current schema reader

## Validation Pipeline

1. **Schema compilation** (`schema-compiler.ts`): resolves `$ref`, collects `id`/`$id`, validates schema structure.
2. **Schema validation** (`schema-validator.ts`): validates the schema against its meta-schema (draft-04, draft-06, draft-07, draft-2019-09, or draft-2020-12).
3. **JSON validation** (`json-validation.ts`): validates a JSON instance against the compiled schema (type checks, constraints, combiners like `allOf`/`anyOf`/`oneOf`/`not`, `unevaluatedProperties`/`unevaluatedItems` with full annotation-based evaluation tracking across applicators and dynamic references, and `format` behavior controlled by `ZSchemaOptions.formatAssertions` — supporting vocabulary-aware annotation-only mode for draft 2019-09/2020-12).
4. **Report** (`report.ts`): errors accumulate in a `Report` object, then get converted into a `ValidateError`.

## ValidateOptions

The `validate()` methods accept an optional `ValidateOptions` parameter:

```typescript
interface ValidateOptions {
  schemaPath?: string; // validate against a sub-path within the schema
  includeErrors?: Array<ErrorCode>; // only report these error codes
  excludeErrors?: Array<ErrorCode>; // suppress these error codes
}
```

## JSON Schema Version Support

Currently supported: `draft-04`, `draft-06`, `draft-07`, `draft2019-09`, `draft2020-12`. Default is **`draft2020-12`**. Set via `ZSchemaOptions.version`.

Draft-06 adds: `$id`, `const`, `contains`, `propertyNames`, `examples`, boolean schemas (`true`/`false`), numeric `exclusiveMinimum`/`exclusiveMaximum` (instead of boolean).

Draft-07 adds: `if`/`then`/`else`, `readOnly`, `writeOnly`, `contentMediaType`, `contentEncoding`, `comment`.

Draft-2019-09 adds: `$anchor`, `$recursiveRef`/`$recursiveAnchor`, `$defs`, `dependentRequired`, `dependentSchemas`, `maxContains`, `minContains`, `unevaluatedItems` (with annotation-aware tracking through applicators, `contains`, `$recursiveRef`), `unevaluatedProperties` (with annotation-aware tracking through applicators, `dependentSchemas`, `$recursiveRef`).

Draft-2020-12 adds: `$dynamicRef`/`$dynamicAnchor`, `prefixItems` (replaces array-form `items`), refined `items` (applies to remaining items). `unevaluatedItems` and `unevaluatedProperties` support dynamic reference resolution via `$dynamicRef`.

Use `version: 'none'` to skip meta-schema version detection (schemas validate using whatever `$schema` declares, or no meta-schema enforcement).

Meta-schemas are bundled in `src/schemas/` (copied from `json-schema-spec/` at build time by `scripts/copy-schemas.mts`).

## Build Outputs

| Output  | Format                         | Entry                        |
| ------- | ------------------------------ | ---------------------------- |
| `dist/` | ESM + types                    | `src/index.ts` via `tsc`     |
| `cjs/`  | CommonJS                       | `src/index.ts` via Rollup    |
| `umd/`  | UMD (browser global `ZSchema`) | `src/z-schema.ts` via Rollup |

The `src/package.json` contains `{ "type": "module" }` and gets copied to `dist/` to mark ESM output.

## Key Internal Types

- `JsonSchema` — union of `JsonSchemaDraft4 | JsonSchemaDraft6 | JsonSchemaDraft7 | JsonSchemaDraft201909 | JsonSchemaDraft202012`
- `JsonSchemaInternal` — internal schema type with compiler metadata (`__$compiled`, `__$validationOptions`, etc.)
- `ValidateError` — error class thrown/returned on validation failure, contains `.details` array of `SchemaErrorDetail`
- `SchemaErrorDetail` — individual error with `message`, `code`, `params`, `path`, `schemaPath`, `inner` (sub-errors for combiners)
- `ValidateResponse` — `{ valid: boolean; err?: ValidateError }` (returned by safe variants)
- `ZSchemaOptions` — all validator configuration options
- `SchemaReader` — `(uri: string) => JsonSchema` sync function for loading schemas on demand
- `FormatValidatorFn` — `(input: unknown) => boolean | Promise<boolean>` format validator signature

## Public Exports (from `src/index.ts`)

Types: `ErrorCode`, `ErrorParam`, `Errors`, `FormatValidatorFn`, `FormatValidatorsOptions`, `JsonSchema`, `JsonSchemaType`, `Report`, `SchemaErrorDetail`, `ZSchema`, `ZSchemaAsync`, `ZSchemaAsyncSafe`, `ZSchemaSafe`, `ValidateOptions`, `ValidateResponse`, `ZSchemaOptions`, `SchemaReader`

Values: `ValidateError`, `getFormatValidators`, `getRegisteredFormats`, `getSupportedFormats`, `isFormatSupported`, `registerFormat`, `unregisterFormat`

Default export: `ZSchema`

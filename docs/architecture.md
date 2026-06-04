# Architecture

## Module Dependency Flow

```
index.ts (public API)
  ├─ z-schema-compiler.ts (ZSchemaCompiler — compile-to-function wrapper; depends on z-schema.ts)
  └─ z-schema.ts (ZSchema, ZSchemaSafe, ZSchemaAsync, ZSchemaAsyncSafe)
       ├─ z-schema-versions.ts (register bundled draft-04/draft-06/draft-07/draft-2019-09/draft-2020-12 meta-schemas)
       └─ z-schema-base.ts (ZSchemaBase — core validation orchestration)
            ├─ schema-compiler.ts (compile schemas, resolve $ref, collect ids)
            ├─ schema-validator.ts (validate schemas against meta-schemas)
            ├─ json-validation.ts (validate JSON data — orchestration, recurse*, collectEvaluated)
            │    └─ validation/  (keyword validators split by category)
            │         ├─ shared.ts (JsonValidatorFn type, vocab helpers, caching)
            │         ├─ type.ts (type, enum, const)
            │         ├─ numeric.ts (multipleOf, minimum, maximum, exclusiveMin/Max)
            │         ├─ string.ts (minLength, maxLength, pattern, format, content*)
            │         ├─ array.ts (items, prefixItems, contains, min/maxItems, uniqueItems)
            │         ├─ object.ts (properties, patternProperties, additionalProperties, required, etc.)
            │         ├─ combinators.ts (allOf, anyOf, oneOf, not, if/then/else)
            │         └─ ref.ts ($dynamicRef/$recursiveRef resolution)
            ├─ schema-cache.ts (cache schemas by URI and id)
            ├─ report.ts (accumulate validation errors)
            ├─ errors.ts (error codes, ValidateError)
            ├─ format-validators.ts (built-in + custom format validation)
            ├─ json-schema.ts (shared/common schema definitions + helpers)
            ├─ json-schema-versions.ts (draft-specific interfaces with layered inheritance + JsonSchemaAll superset)
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
3. **JSON validation** (`json-validation.ts` + `validation/*.ts`): validates a JSON instance against the compiled schema. Keyword validators are split into category modules under `validation/` (type, numeric, string, array, object, combinators, ref). The orchestration layer in `json-validation.ts` handles the `JsonValidators` dispatch table, `validate()`, `recurseArray()`, `recurseObject()`, `collectEvaluated()`, and `unevaluatedItems`/`unevaluatedProperties`. Validator modules that need recursive validation (combinators, contains, dependencies, propertyNames) import `validate` via ESM circular import — safe because `export function validate()` is hoisted and ESM provides live bindings.
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

## Schema Caching

`SchemaCache` (`schema-cache.ts`) maintains two levels of cache:

- **Global cache** (`SchemaCache.global_cache`) — a static object shared across all `ZSchema` instances in the process. Populated by `ZSchema.setRemoteReference()` and by bundled draft meta-schemas registered at import time. This is intentional: common references (meta-schemas, shared definitions) are registered once and available to every instance.
- **Instance cache** (`this.cache`) — per-instance, populated by `validator.setRemoteReference()` and by schemas cloned from the global cache on first access. Instance cache entries take precedence over global ones.

When a schema is looked up by URI, the instance cache is checked first. If not found, the global cache entry is deep-cloned into the instance cache (so compilation metadata doesn't leak between instances) and returned. Subsequent lookups for the same URI on the same instance hit the instance cache directly without re-cloning.

## Build Outputs

| Output  | Format                         | Entry                        |
| ------- | ------------------------------ | ---------------------------- |
| `dist/` | ESM (`.js`) + types (`.d.ts`)  | `src/index.ts` via tsdown    |
| `cjs/`  | CommonJS (`.cjs` + `.d.cts`)   | `src/index.ts` via tsdown    |
| `umd/`  | UMD (browser global `ZSchema`) | `src/z-schema.ts` via tsdown |

The package is ESM-first (`"type": "module"`), so all outputs are produced by [tsdown](https://tsdown.dev/) (powered by Rolldown) with type-appropriate extensions: ESM uses `.js`, CommonJS uses `.cjs` (with a `umd/package.json` `{"type":"commonjs"}` marker so the UMD bundles remain CommonJS for Node `require`). The `package.json` exports map uses conditional `import`/`require` to route consumers to the correct format.

## Key Internal Types

- `JsonSchemaCommon` — interface with properties present in **all** JSON Schema drafts (04–2020-12)
- `JsonSchemaDraft4` — extends `JsonSchemaCommon`, adds `id`
- `JsonSchemaDraft6` — extends `JsonSchemaCommon`, adds `$id`, `const`, `contains`, `propertyNames`, `examples`
- `JsonSchemaDraft7` — extends `JsonSchemaDraft6`, adds `if`/`then`/`else`, `contentEncoding`/`contentMediaType`
- `JsonSchemaDraft201909` — extends `JsonSchemaDraft7`, adds `$defs`, `$anchor`, `$vocabulary`, `$recursiveAnchor`/`$recursiveRef`, `dependentSchemas`/`dependentRequired`, `unevaluatedItems`/`unevaluatedProperties`, `maxContains`/`minContains`
- `JsonSchemaDraft202012` — extends `JsonSchemaDraft201909`, adds `$dynamicAnchor`/`$dynamicRef`, `prefixItems`
- `JsonSchema` — union of all draft interfaces (public API type)
- `JsonSchemaAll` — manually defined superset interface with all draft-specific properties and `boolean | number` for `exclusiveMinimum`/`exclusiveMaximum`
- `JsonSchemaInternal` — `JsonSchemaAll & ZSchemaInternalProperties` — internal schema type with compiler metadata (`__$compiled`, `__$validationOptions`, etc.)
- `ValidateError` — error class thrown/returned on validation failure, contains `.details` array of `SchemaErrorDetail`
- `SchemaErrorDetail` — individual error with `message`, `code`, `params`, `path`, `schemaPath`, `inner` (sub-errors for combiners)
- `ValidateResponse` — `{ valid: boolean; err?: ValidateError }` (returned by safe variants)
- `ZSchemaOptions` — all validator configuration options
- `SchemaReader` — `(uri: string) => JsonSchema` sync function for loading schemas on demand
- `FormatValidatorFn` — `(input: unknown) => boolean | Promise<boolean>` format validator signature

## Public Exports (from `src/index.ts`)

Types: `ErrorCode`, `ErrorParam`, `Errors`, `FormatValidatorFn`, `FormatValidatorsOptions`, `JsonSchema`, `JsonSchemaCommon`, `JsonSchemaDraft4`, `JsonSchemaDraft6`, `JsonSchemaDraft7`, `JsonSchemaDraft201909`, `JsonSchemaDraft202012`, `JsonSchemaType`, `JsonSchemaVersion`, `Report`, `SchemaErrorDetail`, `ZSchema`, `ZSchemaAsync`, `ZSchemaAsyncSafe`, `ZSchemaSafe`, `ValidateOptions`, `ValidateResponse`, `ZSchemaOptions`, `SchemaReader`

Values: `ValidateError`, `getFormatValidators`, `getRegisteredFormats`, `getSupportedFormats`, `isFormatSupported`, `registerFormat`, `unregisterFormat`, `ZSchemaCompiler`

Additional public API for Compiler usage:

- `ZSchemaCompiler` (named export from `z-schema`)
- Types: `ValidateFunction`, `SafeValidateFunction`, `AsyncValidateFunction`, `AsyncSafeValidateFunction`, `CompiledValidateFunction`, `InferValidateFunction`

Default export: `ZSchema`

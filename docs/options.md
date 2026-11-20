# Options

All options are passed to `ZSchema.create(options)`. Default values are shown where applicable.

## async

When true, `ZSchema.create()` returns an async validator (`ZSchemaAsync` or `ZSchemaAsyncSafe`). The `validate()` method returns a `Promise` instead of a synchronous result. Required when using async format validators.

This is a factory-only option: `ZSchema.create()` reads it to pick the validator class. It stays on the options object you passed, so the same object can be reused to create another validator.

Default: `false`

```javascript
const validator = ZSchema.create({ async: true });
await validator.validate(data, schema); // returns Promise<true>
```

## safe

When true, `ZSchema.create()` returns a safe validator (`ZSchemaSafe` or `ZSchemaAsyncSafe`). The `validate()` method returns a result object `{ valid, err? }` instead of throwing on error.

This is a factory-only option: `ZSchema.create()` reads it to pick the validator class. It stays on the options object you passed, so the same object can be reused to create another validator.

Default: `false`

```javascript
const validator = ZSchema.create({ safe: true });
const result = validator.validate(data, schema);
// result: { valid: boolean, err?: ValidateError }
```

Combine both for async + safe:

```javascript
const validator = ZSchema.create({ async: true, safe: true });
const result = await validator.validate(data, schema);
// result: { valid: boolean, err?: ValidateError }
```

## version

Sets the JSON Schema draft version to validate against.

- `'draft-04'` — JSON Schema draft-04
- `'draft-06'` — JSON Schema draft-06
- `'draft-07'` — JSON Schema draft-07
- `'draft2019-09'` — JSON Schema draft-2019-09
- `'draft2020-12'` **(default)** — JSON Schema draft-2020-12 (latest)
- `'none'` — skip meta-schema version detection (schemas validate using whatever `$schema` declares)

```javascript
const validator = ZSchema.create({
  version: 'draft2020-12',
});
```

## asyncTimeout

Defines a total time limit in milliseconds for all async work in one validation (such as async format validators, including those inside applicators like `anyOf` or `if`) before validation fails with an `ASYNC_TIMEOUT` error. In the `ASYNC_TIMEOUT` message, `{0}` is the number of pending top-level tasks.

Values are clamped to the range `[0, 60 000]` during option normalization to prevent resource exhaustion (CWE-400). Any value above `60 000` is silently reduced to `60 000`.

> **Performance:** Set this to the lowest value that accommodates your slowest async format validator. A tight timeout prevents validation from hanging on unresponsive external services.

Default: `2000`

```javascript
const validator = ZSchema.create({
  asyncTimeout: 5000,
});
```

## noEmptyArrays

When true, the validator treats empty arrays as invalid for type `array`, unless the schema explicitly sets `minItems: 0`.

Default: `false`

```javascript
const validator = ZSchema.create({
  noEmptyArrays: true,
});
```

## noEmptyStrings

When true, the validator treats empty strings as invalid for type `string`, unless the schema explicitly sets `minLength: 0`.

Default: `false`

```javascript
const validator = ZSchema.create({
  noEmptyStrings: true,
});
```

## noTypeless

When true, the validator rejects schemas that do not specify a `type`.

Default: `false`

```javascript
const validator = ZSchema.create({
  noTypeless: true,
});
```

## noExtraKeywords

When true, the validator rejects schemas that contain keywords not defined in the JSON Schema specification, unless the schema provides a `$schema` property for validation.

Default: `false`

```javascript
const validator = ZSchema.create({
  noExtraKeywords: true,
});
```

## assumeAdditional

> **Performance:** When enabled (especially as `true`), the validator must check every property in every object against `properties`/`patternProperties` even when the schema doesn't declare `additionalProperties`. This adds overhead proportional to the number of object properties in the input data.

When `true`, the validator assumes `additionalItems` and `additionalProperties` are `false` in all schemas, so you do not need to set it manually.

When an array of strings, the validator assumes `additionalItems`/`additionalProperties` are `false` but allows the listed properties to pass.

Default: `false`

```javascript
// reject all additional properties/items
const validator = ZSchema.create({
  assumeAdditional: true,
});

// reject additional properties/items except $ref
const validator = ZSchema.create({
  assumeAdditional: ['$ref'],
});
```

## forceAdditional

When true, the validator rejects schemas where `additionalItems`/`additionalProperties` is not explicitly defined.

Default: `false`

```javascript
const validator = ZSchema.create({
  forceAdditional: true,
});
```

## forceItems

When true, the validator rejects schemas where `items` is not defined for `array` type schemas.

> **Performance:** This is a schema-level check that runs during compilation, not during data validation. The overhead is negligible.

Default: `false`

```javascript
const validator = ZSchema.create({
  forceItems: true,
});
```

## forceMinItems

When true, the validator rejects schemas where `minItems` is not defined for `array` type schemas.

Default: `false`

```javascript
const validator = ZSchema.create({
  forceMinItems: true,
});
```

## forceMaxItems

When true, the validator rejects schemas where `maxItems` is not defined for `array` type schemas.

Default: `false`

```javascript
const validator = ZSchema.create({
  forceMaxItems: true,
});
```

## forceMinLength

When true, the validator rejects schemas where `minLength` is not defined for `string` type schemas.

Default: `false`

```javascript
const validator = ZSchema.create({
  forceMinLength: true,
});
```

## forceMaxLength

When true, the validator rejects schemas where `maxLength` is not defined for `string` type schemas.

Default: `false`

```javascript
const validator = ZSchema.create({
  forceMaxLength: true,
});
```

## forceProperties

When true, the validator rejects schemas where `properties` or `patternProperties` is not defined for `object` type schemas.

Default: `false`

```javascript
const validator = ZSchema.create({
  forceProperties: true,
});
```

## ignoreUnresolvableReferences

When true, the validator does not report an error when a remote `$ref` cannot be resolved. Not recommended for production.

> **Performance:** This option does not skip `$ref` resolution — it only suppresses the error. The resolver still attempts to look up each reference. Use `setRemoteReference()` or a schema reader to register remote schemas ahead of time for best performance.

Default: `false`

```javascript
const validator = ZSchema.create({
  ignoreUnresolvableReferences: true,
});
```

## enumCaseInsensitiveComparison

When true, the validator reports `ENUM_CASE_MISMATCH` when an enum value matches in value but differs in case.

Default: `false`

```javascript
const validator = ZSchema.create({
  enumCaseInsensitiveComparison: true,
});
```

## strictUris

When true, all strings of format `uri` must be absolute URIs (not just URI references).

Default: `false`

```javascript
const validator = ZSchema.create({
  strictUris: true,
});
```

## strictMode

Enables multiple strict checks at once. This adds schema-level validation overhead for every schema processed.

> **Performance:** Each sub-option enabled by `strictMode` adds a check during schema validation. For large schemas with many sub-schemas, this increases validation time. Consider enabling only the specific checks you need rather than the full `strictMode` bundle.

Setting `strictMode: true` is equivalent to:

```javascript
{
  forceAdditional: true,
  forceItems: true,
  forceMaxLength: true,
  forceProperties: true,
  noExtraKeywords: true,
  noTypeless: true,
  noEmptyStrings: true,
  noEmptyArrays: true,
}
```

Default: `false`

```javascript
const validator = ZSchema.create({
  strictMode: true,
});
```

## breakOnFirstError

When true, validation stops after the first error is found.

In async mode, only the first recorded error is kept. It can differ from the error sync mode reports, because async results arrive later.

> **Performance:** Enabling this option can significantly speed up validation of invalid data by short-circuiting as soon as the first error is found, rather than collecting all errors. Recommended for production use when you only need to know whether data is valid.

Default: `false`

```javascript
const validator = ZSchema.create({
  breakOnFirstError: true,
});
```

## reportPathAsArray

When true, error paths are reported as arrays of path segments instead of JSON Pointer strings.

Default: `false`

```javascript
const validator = ZSchema.create({
  reportPathAsArray: true,
});
```

## pedanticCheck

When true, the validator checks whether schemas follow best practices and common conventions.

> **Performance:** Adds extra checks during schema validation. Consider enabling only during development or CI, and disabling in production where schema quality is already assured.

Default: `false`

```javascript
const validator = ZSchema.create({
  pedanticCheck: true,
});
```

## ignoreUnknownFormats

When true, unknown format names (not registered and not built-in) are silently ignored instead of reported as errors. The [JSON Schema specification](http://json-schema.org/latest/json-schema-validation.html#anchor106) recommends offering an option to disable format validation.

> **Note:** For draft 2019-09 and draft 2020-12, unknown formats are silently ignored regardless of this setting, since format is annotation-only by default in these drafts. The one exception is `formatAssertions: true` with a meta-schema that opts in to format assertion (see [formatAssertions](#formatassertions)): an unknown format is then reported as `UNKNOWN_FORMAT`, unless this option is `true`.

Default: `false`

```javascript
const validator = ZSchema.create({
  ignoreUnknownFormats: true,
});
```

## formatAssertions

Controls whether `format` is treated as an assertion during validation.

- `null` (default): legacy behavior — always assert format validation (built-in/custom format validators are enforced and report `INVALID_FORMAT` on mismatch).
- `true`: respect the meta-schema `$vocabulary` — for draft 2019-09 and draft 2020-12, format is annotation-only unless the meta-schema opts in to assertion. In draft 2020-12 it opts in by listing the format-assertion vocabulary in `$vocabulary`, as `true` or as `false`: the value only tells implementations that do not know the vocabulary whether they may process the schema anyway. In draft 2019-09 it opts in by setting the format vocabulary to `true`; the standard meta-schema sets it to `false`. Under a meta-schema that opts in, an unknown format name is an `UNKNOWN_FORMAT` error unless `ignoreUnknownFormats` is `true`. For older drafts (draft-04/06/07), format is always asserted.
- `false`: treat `format` as annotation-only (no assertion failures for format checks in any draft).

Default: `null`

```javascript
// Vocabulary-aware (recommended for draft 2019-09 / 2020-12):
const validator = ZSchema.create({
  formatAssertions: true,
});

// Annotation-only (never assert):
const validator = ZSchema.create({
  formatAssertions: false,
});

// Legacy behavior (always assert, same as old default):
const validator = ZSchema.create({
  formatAssertions: null,
});
```

## customValidator

Register a function that is called on every sub-schema during validation. Use this for custom cross-field validation logic that cannot be expressed in standard JSON Schema.

In async mode, it runs after the node's async results are in (including the async results of `unevaluatedProperties`/`unevaluatedItems` schemas of that node). With `breakOnFirstError`, a hook deferred behind pending async work may not run once an error has already stopped the validation.

> **Performance:** The custom validator function is invoked for **every** sub-schema during JSON validation. Keep the function fast and avoid expensive operations (network calls, heavy computation) inside it. For field-level checks, prefer [custom formats](features.md#register-a-custom-format) which only run when the `format` keyword is present.

> Consider using [custom formats](features.md#register-a-custom-format) before using this option.

Default: `undefined`

**Example:** Validate that two properties in an object never have the same value, using a custom `uniqueProperties` keyword:

```javascript
function customValidatorFn(report, schema, json) {
  if (Array.isArray(schema.uniqueProperties)) {
    const seen = [];
    schema.uniqueProperties.forEach((prop) => {
      const value = json[prop];
      if (value !== undefined) {
        if (seen.indexOf(value) !== -1) {
          report.addCustomError(
            'NON_UNIQUE_PROPERTY_VALUE',
            'Property "{0}" has non-unique value: {1}',
            [prop, value],
            null,
            schema.description
          );
        }
        seen.push(value);
      }
    });
  }
}

const validator = ZSchema.create({
  customValidator: customValidatorFn,
});
```

Testing it:

```javascript
const schema = {
  type: 'object',
  properties: {
    fromId: { type: 'integer' },
    toId: { type: 'integer' },
  },
  uniqueProperties: ['fromId', 'toId'],
};

const data = { fromId: 123, toId: 123, amount: 50 };

try {
  validator.validate(data, schema);
} catch (error) {
  console.log(error.details);
  // [{ code: 'NON_UNIQUE_PROPERTY_VALUE',
  //    params: ['toId', 123],
  //    message: 'Property "toId" has non-unique value: 123',
  //    path: '#/' }]
}
```

> Before creating your own keywords, consider compatibility implications.

## customFormats

Register custom format validators at creation time. Each key is a format name and each value is a function `(input: unknown) => boolean | PromiseLike<boolean>`, or `null` to disable a format.

The formats apply to the created instance only. The object is copied at creation: later changes to it have no effect, and `registerFormat()` / `unregisterFormat()` on the instance do not modify it.

Default: `undefined`

```javascript
const validator = ZSchema.create({
  customFormats: {
    'postal-code': (value) => typeof value === 'string' && /^\d{5}(-\d{4})?$/.test(value),
  },
});
```

## maxRecursionDepth

Maximum recursion depth for internal traversal functions (`deepClone`, `areEqual`, `findId`, `collectIds`, `collectReferences`, `collectEvaluated`). Prevents stack overflows on pathologically deep or circular schemas/data. If your schemas or data are legitimately deeply nested and you encounter a "Maximum recursion depth exceeded" error, increase this value.

Default: `100`

```javascript
const validator = ZSchema.create({
  maxRecursionDepth: 200,
});
```

## maxDataDepth

How deeply the validated data may be nested. The root value is at depth `0`; a subschema may be applied to a value at depth `maxDataDepth` or less. Validation stops when it is about to validate the children of an array or object that is itself at depth `maxDataDepth`. Data the schema never descends into is not measured.

At the limit the validation ends with a `ValidateError` whose `details` has one entry: code `MAX_DATA_DEPTH_EXCEEDED`, `params: [limit]`, and the path of the container that was not entered (an item reached through `contains`, `unevaluatedItems` or `unevaluatedProperties` adds no segment to it). Errors found before the limit was reached are not included. With `safe: true` the result is `{ valid: false, err }`; in async mode it is delivered the same way as other errors. `excludeErrors` does not suppress it.

`Infinity` turns the limit off; very deep data is then bounded only by the engine's call stack. A negative number means `0` (only the root value is validated), fractions are rounded down, and non-numbers fall back to the default. The limit applies to data validation only, not to schema compilation or schema validation. It is separate from [`maxRecursionDepth`](#maxrecursiondepth), which bounds schema walks, cloning, equality (`enum` / `const` / `uniqueItems`) and evaluated-annotation collection. A `customValidator` that calls the public `validate()` starts a new count for that call.

The limit counts data levels, not stack frames. The number of stack frames per level depends on the schema: schemas with many nested applicators or `$ref` hops per level use more, and may need a lower value to stay inside the engine's call stack. Validation descends only as far as it needs to decide the result, so which data is measured can differ between the first call on a schema and later cached calls; see [compile()](features.md).

Default: `500`

```javascript
const validator = ZSchema.create({
  maxDataDepth: 50,
});

try {
  validator.validate(deeplyNestedData, schema);
} catch (err) {
  console.log(err.details);
  // [{ code: 'MAX_DATA_DEPTH_EXCEEDED',
  //    params: [50],
  //    message: 'Data is nested deeper than the maxDataDepth limit (50).',
  //    path: '#/a/a/a/…' }]
}
```

## sizeLimitsFirst

Whether a value that exceeds a size limit of a schema node skips the content checks of that node. When a value exceeds a limit, that node runs no further checks on the value's content and does not validate its children:

| Value  | Limit exceeded  | Not run on this node for this value                                                                                                            |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| string | `maxLength`     | `pattern`, `format`, `contentEncoding`, `contentMediaType`                                                                                     |
| array  | `maxItems`      | `uniqueItems`, `contains`, `unevaluatedItems`, and the validation of its items (`items` / `prefixItems` / `additionalItems`)                   |
| object | `maxProperties` | `properties`, `patternProperties`, `additionalProperties`, `propertyNames`, `unevaluatedProperties`, and the validation of its property values |

The validity of the result is the same with the option on or off: the value is invalid either way. Only `err.details` differs. With the option on, such a value gets the limit's error (`MAX_LENGTH`, `ARRAY_LENGTH_LONG`, `OBJECT_PROPERTIES_MAXIMUM`) and the errors of the keywords that still run, but not the errors of the skipped keywords or of the value's items and properties.

These keywords still run on the node: `type`, `enum`, `const`, `required`, the minimum keywords, `dependentRequired`, and the applicators that stay on the same value (`$ref`, `allOf`, `anyOf`, `oneOf`, `not`, `if`, `dependencies`, `dependentSchemas`). A `customValidator` still runs for the node.

The rule works per schema node. A size limit and an expensive keyword in different subschemas of the same value do not affect each other: in `{ maxItems: 10, allOf: [{ items: … }] }` the items are still validated. Put the limit in the same schema object as the keywords it should stop.

A limit that is not evaluated stops nothing: its error code filtered by `excludeErrors` / `includeErrors`, or the validation vocabulary disabled for the schema. With `breakOnFirstError: true`, the limit's error is the one reported for such a value. A custom format function is not called for a string that exceeds `maxLength` of the same schema node. With [`maxDataDepth`](#maxdatadepth), an array or object that exceeds its size limit is not entered, so it reports the size error and not `MAX_DATA_DEPTH_EXCEEDED`. On the cached fast path the size limits are checked before the node's other keywords regardless of the option; the fast path reports no errors, so the order cannot be observed in results.

`false` runs every keyword on every value and reports all errors, as in 12.8.0 and earlier.

Default: `true`

```javascript
const schema = { type: 'string', maxLength: 5, pattern: '^a+$' };

const validator = ZSchema.create({ sizeLimitsFirst: true });
try {
  validator.validate('abcdefgh', schema);
} catch (err) {
  console.log(err.details);
  // [{ code: 'MAX_LENGTH',
  //    params: [8, 5],
  //    message: 'String is too long (8 chars), maximum 5',
  //    path: '#/' }]
}

const all = ZSchema.create({ sizeLimitsFirst: false });
try {
  all.validate('abcdefgh', schema);
} catch (err) {
  console.log(err.details.map((d) => d.code));
  // [ 'MAX_LENGTH', 'PATTERN' ]
}
```

## maxErrors

Maximum number of error details one `validate()` call reports, counting every detail, including those nested in `inner`. Keeps the error list small for large invalid inputs.

The result's validity never depends on this option. The reported details are the first ones an unlimited run would report: `details` is a prefix of the unlimited list and each `inner` list is a prefix of the unlimited one (a detail can be kept while its `inner` list is cut short or empty). `err.truncated` is `true` when the limit left out at least one detail while the data was validated; otherwise the property is absent. In async mode with `breakOnFirstError`, the result is cut to its first error after validation, so `truncated` can be `true` on a result with a single, complete detail.

`Infinity` turns the limit off. Values below `1` become `1`, fractions are rounded down, and non-numbers fall back to the default. The limit applies to data validation; schema validation (`validateSchema`, `compile`) reports all schema errors. It is independent of `breakOnFirstError`, and `includeErrors` / `excludeErrors` filter before details are counted.

Default: `1000`

```javascript
const validator = ZSchema.create({
  maxErrors: 100,
});

try {
  validator.validate(data, schema);
} catch (err) {
  console.log(err.details.length); // at most 100
  console.log(err.truncated); // true when the limit left out at least one detail while the data was validated
}
```

---

## Per-call Options (ValidateOptions)

These options are passed as the third argument to `validate()`, not to `ZSchema.create()`.

### schemaPath

Validate against a sub-path within the schema:

```javascript
validator.validate(data, schema, { schemaPath: 'definitions.car' });
```

### includeErrors

Only report the specified error codes (all others are suppressed):

```javascript
validator.validate(data, schema, { includeErrors: ['INVALID_TYPE'] });
```

### excludeErrors

Suppress the specified error codes from the report:

```javascript
validator.validate(data, schema, { excludeErrors: ['MIN_LENGTH', 'MINIMUM'] });
```

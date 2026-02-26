# Options

All options are passed to `ZSchema.create(options)`. Default values are shown where applicable.

## async

When true, `ZSchema.create()` returns an async validator (`ZSchemaAsync` or `ZSchemaAsyncSafe`). The `validate()` method returns a `Promise` instead of a synchronous result. Required when using async format validators.

This is a factory-only option — it is consumed by `ZSchema.create()` and not stored in the validator instance.

Default: `false`

```javascript
const validator = ZSchema.create({ async: true });
await validator.validate(data, schema); // returns Promise<true>
```

## safe

When true, `ZSchema.create()` returns a safe validator (`ZSchemaSafe` or `ZSchemaAsyncSafe`). The `validate()` method returns a result object `{ valid, err? }` instead of throwing on error.

This is a factory-only option — it is consumed by `ZSchema.create()` and not stored in the validator instance.

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

Defines a time limit in milliseconds for async tasks (such as async format validators) before validation fails with an `ASYNC_TIMEOUT` error.

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

Enables multiple strict checks at once. Setting `strictMode: true` is equivalent to:

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

Default: `false`

```javascript
const validator = ZSchema.create({
  pedanticCheck: true,
});
```

## ignoreUnknownFormats

When true, unknown format names (not registered and not built-in) are silently ignored instead of reported as errors. The [JSON Schema specification](http://json-schema.org/latest/json-schema-validation.html#anchor106) recommends offering an option to disable format validation.

Default: `false`

```javascript
const validator = ZSchema.create({
  ignoreUnknownFormats: true,
});
```

## customValidator

Register a function that is called on every sub-schema during validation. Use this for custom cross-field validation logic that cannot be expressed in standard JSON Schema.

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

Register custom format validators at creation time. Each key is a format name and each value is a function `(input: unknown) => boolean | Promise<boolean>`, or `null` to disable a format.

Default: `undefined`

```javascript
const validator = ZSchema.create({
  customFormats: {
    'postal-code': (value) => typeof value === 'string' && /^\d{5}(-\d{4})?$/.test(value),
  },
});
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

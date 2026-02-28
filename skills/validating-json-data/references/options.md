# Options Reference

All options are passed to `ZSchema.create(options)`. This file lists every option with its type, default, and behavior.

## Table of contents

- [Factory options](#factory-options)
- [Draft version](#draft-version)
- [Data validation behavior](#data-validation-behavior)
- [Schema strictness](#schema-strictness)
- [Strict mode shortcut](#strict-mode-shortcut)
- [Format handling](#format-handling)
- [Reference handling](#reference-handling)
- [Error reporting](#error-reporting)
- [Custom extensions](#custom-extensions)
- [Per-call options (ValidateOptions)](#per-call-options-validateoptions)

---

## Factory options

These are consumed by `ZSchema.create()` and determine which validator variant is returned. They are not stored on the instance.

| Option  | Type      | Default | Effect                                                                             |
| ------- | --------- | ------- | ---------------------------------------------------------------------------------- |
| `async` | `boolean` | `false` | Returns async validator; `validate()` returns a `Promise`                          |
| `safe`  | `boolean` | `false` | Returns safe validator; `validate()` returns `{ valid, err? }` instead of throwing |

Combine both: `ZSchema.create({ async: true, safe: true })`.

## Draft version

| Option    | Type     | Default          | Effect                                |
| --------- | -------- | ---------------- | ------------------------------------- |
| `version` | `string` | `'draft2020-12'` | JSON Schema draft to validate against |

Values: `'draft-04'` · `'draft-06'` · `'draft-07'` · `'draft2019-09'` · `'draft2020-12'` · `'none'`

`'none'` skips meta-schema version detection — schemas validate using whatever `$schema` declares.

## Data validation behavior

| Option                          | Type                  | Default | Effect                                                                                                                 |
| ------------------------------- | --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `noEmptyStrings`                | `boolean`             | `false` | Empty strings are invalid for type `string` (unless `minLength: 0`)                                                    |
| `noEmptyArrays`                 | `boolean`             | `false` | Empty arrays are invalid for type `array` (unless `minItems: 0`)                                                       |
| `assumeAdditional`              | `boolean \| string[]` | `false` | Treat `additionalProperties`/`additionalItems` as `false`; array form allows listed properties                         |
| `enumCaseInsensitiveComparison` | `boolean`             | `false` | Report `ENUM_CASE_MISMATCH` for case-only differences                                                                  |
| `strictUris`                    | `boolean`             | `false` | All `uri` format strings must be absolute URIs                                                                         |
| `asyncTimeout`                  | `number`              | `2000`  | Milliseconds before async format validators time out                                                                   |
| `maxRecursionDepth`             | `number`              | `100`   | Maximum recursion depth for schema traversal, deep clone, and equality checks. Increase for deeply nested schemas/data |

## Schema strictness

These options cause `validateSchema()` and `validate()` to reject schemas missing certain keywords.

| Option            | Type      | Default | Effect                                                           |
| ----------------- | --------- | ------- | ---------------------------------------------------------------- |
| `noTypeless`      | `boolean` | `false` | Reject schemas without `type`                                    |
| `noExtraKeywords` | `boolean` | `false` | Reject schemas with non-standard keywords                        |
| `forceAdditional` | `boolean` | `false` | Require `additionalProperties` / `additionalItems` to be defined |
| `forceItems`      | `boolean` | `false` | Require `items` in array schemas                                 |
| `forceMinItems`   | `boolean` | `false` | Require `minItems` in array schemas                              |
| `forceMaxItems`   | `boolean` | `false` | Require `maxItems` in array schemas                              |
| `forceMinLength`  | `boolean` | `false` | Require `minLength` in string schemas                            |
| `forceMaxLength`  | `boolean` | `false` | Require `maxLength` in string schemas                            |
| `forceProperties` | `boolean` | `false` | Require `properties` or `patternProperties` in object schemas    |
| `pedanticCheck`   | `boolean` | `false` | Check schemas for best practices                                 |

## Strict mode shortcut

`strictMode: true` enables all of these at once:

```
forceAdditional, forceItems, forceMaxLength, forceProperties,
noExtraKeywords, noTypeless, noEmptyStrings, noEmptyArrays
```

## Format handling

| Option                 | Type              | Default | Effect                                                                                                                                 |
| ---------------------- | ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ignoreUnknownFormats` | `boolean`         | `false` | Suppress `UNKNOWN_FORMAT` errors for unrecognized formats. Modern drafts (2019-09, 2020-12) always ignore unknown formats regardless.  |
| `formatAssertions`     | `null \| boolean` | `null`  | `null`=always assert (legacy), `true`=respect vocabulary (annotation-only for 2019-09/2020-12), `false`=annotation-only for all drafts |

## Reference handling

| Option                         | Type      | Default | Effect                                                          |
| ------------------------------ | --------- | ------- | --------------------------------------------------------------- |
| `ignoreUnresolvableReferences` | `boolean` | `false` | Silently skip unresolvable `$ref` instead of reporting an error |

## Error reporting

| Option              | Type      | Default | Effect                                                                                  |
| ------------------- | --------- | ------- | --------------------------------------------------------------------------------------- |
| `breakOnFirstError` | `boolean` | `false` | Stop validation at the first error                                                      |
| `reportPathAsArray` | `boolean` | `false` | Error paths as arrays (e.g. `["age"]`) instead of JSON Pointer strings (e.g. `"#/age"`) |

## Custom extensions

| Option            | Type                                        | Default     | Effect                                                                    |
| ----------------- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `customFormats`   | `Record<string, FormatValidatorFn \| null>` | `undefined` | Register format validators at creation time                               |
| `customValidator` | `(report, schema, json) => void`            | `undefined` | Called on every sub-schema during validation for custom cross-field logic |

### customValidator example

```typescript
const validator = ZSchema.create({
  customValidator(report, schema, json) {
    if (Array.isArray(schema.uniqueProperties)) {
      const seen: unknown[] = [];
      for (const prop of schema.uniqueProperties) {
        const value = json[prop];
        if (value !== undefined) {
          if (seen.includes(value)) {
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
      }
    }
  },
});
```

---

## Per-call options (ValidateOptions)

Passed as the third argument to `validate()` / `validateSafe()`, not to `ZSchema.create()`.

| Option          | Type       | Effect                                                                   |
| --------------- | ---------- | ------------------------------------------------------------------------ |
| `schemaPath`    | `string`   | Validate against a sub-path within the schema (e.g. `'definitions.car'`) |
| `includeErrors` | `string[]` | Only report these error codes                                            |
| `excludeErrors` | `string[]` | Suppress these error codes                                               |

```typescript
validator.validate(data, schema, {
  schemaPath: 'definitions.car',
  excludeErrors: ['MIN_LENGTH'],
});
```

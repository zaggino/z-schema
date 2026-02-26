# Options Reference

All options are passed to `ZSchema.create(options)`.

| Option                          | Type                  | Default          | Description                                                                                                                                                       |
| ------------------------------- | --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `async`                         | `boolean`             | `false`          | Factory-only. Returns async validator; `validate()` returns a Promise. Required for async format validators.                                                      |
| `safe`                          | `boolean`             | `false`          | Factory-only. Returns safe validator; `validate()` returns `{ valid, err? }` instead of throwing.                                                                 |
| `version`                       | `string`              | `'draft2020-12'` | JSON Schema draft: `'draft-04'`, `'draft-06'`, `'draft-07'`, `'draft2019-09'`, `'draft2020-12'`, or `'none'`.                                                     |
| `asyncTimeout`                  | `number`              | `2000`           | Timeout (ms) for async tasks before `ASYNC_TIMEOUT` error.                                                                                                        |
| `breakOnFirstError`             | `boolean`             | `false`          | Stop validation after the first error.                                                                                                                            |
| `noEmptyStrings`                | `boolean`             | `false`          | Reject `""` for type `string` (unless `minLength: 0`).                                                                                                            |
| `noEmptyArrays`                 | `boolean`             | `false`          | Reject `[]` for type `array` (unless `minItems: 0`).                                                                                                              |
| `noTypeless`                    | `boolean`             | `false`          | Reject schemas without a `type`.                                                                                                                                  |
| `noExtraKeywords`               | `boolean`             | `false`          | Reject schemas with non-standard keywords.                                                                                                                        |
| `assumeAdditional`              | `boolean \| string[]` | `false`          | Assume `additionalProperties`/`additionalItems` are `false`. Array of strings to allow specific extra properties.                                                 |
| `forceAdditional`               | `boolean`             | `false`          | Reject schemas missing `additionalProperties`/`additionalItems`.                                                                                                  |
| `forceItems`                    | `boolean`             | `false`          | Reject array schemas missing `items`.                                                                                                                             |
| `forceMinItems`                 | `boolean`             | `false`          | Reject array schemas missing `minItems`.                                                                                                                          |
| `forceMaxItems`                 | `boolean`             | `false`          | Reject array schemas missing `maxItems`.                                                                                                                          |
| `forceMinLength`                | `boolean`             | `false`          | Reject string schemas missing `minLength`.                                                                                                                        |
| `forceMaxLength`                | `boolean`             | `false`          | Reject string schemas missing `maxLength`.                                                                                                                        |
| `forceProperties`               | `boolean`             | `false`          | Reject object schemas missing `properties`/`patternProperties`.                                                                                                   |
| `ignoreUnresolvableReferences`  | `boolean`             | `false`          | Silently skip unresolved `$ref`.                                                                                                                                  |
| `enumCaseInsensitiveComparison` | `boolean`             | `false`          | Report `ENUM_CASE_MISMATCH` for case-only differences.                                                                                                            |
| `strictUris`                    | `boolean`             | `false`          | Require `uri` format strings to be absolute URIs.                                                                                                                 |
| `strictMode`                    | `boolean`             | `false`          | Enable multiple strict checks at once (forceAdditional, forceItems, forceMaxLength, forceProperties, noExtraKeywords, noTypeless, noEmptyStrings, noEmptyArrays). |
| `reportPathAsArray`             | `boolean`             | `false`          | Report error paths as arrays instead of JSON Pointer strings.                                                                                                     |
| `pedanticCheck`                 | `boolean`             | `false`          | Check schemas for best practices.                                                                                                                                 |
| `ignoreUnknownFormats`          | `boolean`             | `false`          | Silently ignore unknown formats (modern drafts always ignore).                                                                                                    |
| `formatAssertions`              | `null \| boolean`     | `null`           | `null`=always assert, `true`=respect vocabulary, `false`=annotation-only.                                                                                         |
| `customValidator`               | `function`            | `undefined`      | Called on every sub-schema for custom cross-field validation.                                                                                                     |
| `customFormats`                 | `object`              | `undefined`      | Register format validators at creation time: `{ name: (val) => boolean }`.                                                                                        |

## Per-call options (ValidateOptions)

Passed as the third argument to `validate()`:

| Option          | Type       | Description                                                               |
| --------------- | ---------- | ------------------------------------------------------------------------- |
| `schemaPath`    | `string`   | Validate against a sub-path within the schema (e.g. `'definitions.car'`). |
| `includeErrors` | `string[]` | Only report the listed error codes.                                       |
| `excludeErrors` | `string[]` | Suppress the listed error codes.                                          |

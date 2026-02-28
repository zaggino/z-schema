# Error Codes

Complete list of error codes reported by z-schema. Each error appears in `SchemaErrorDetail.code`.

## Table of contents

- [Type and format errors](#type-and-format-errors)
- [Enum errors](#enum-errors)
- [Combinator errors](#combinator-errors)
- [Array errors](#array-errors)
- [Numeric errors](#numeric-errors)
- [Object errors](#object-errors)
- [String errors](#string-errors)
- [Schema validation errors](#schema-validation-errors)
- [Reference and remote errors](#reference-and-remote-errors)
- [Draft-06+ errors](#draft-06-errors)
- [Draft-2019-09+ errors](#draft-2019-09-errors)
- [Runtime safeguard errors](#runtime-safeguard-errors)

---

## Type and format errors

| Code             | Message template                                  | Trigger                                   |
| ---------------- | ------------------------------------------------- | ----------------------------------------- |
| `INVALID_TYPE`   | Expected type {0} but found type {1}              | Value does not match schema `type`        |
| `INVALID_FORMAT` | Object didn't pass validation for format {0}: {1} | Value fails a registered format validator |

## Enum errors

| Code                 | Message template                  | Trigger                                                                       |
| -------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `ENUM_MISMATCH`      | No enum match for: {0}            | Value not in `enum` list                                                      |
| `ENUM_CASE_MISMATCH` | Enum does not match case for: {0} | Value matches enum ignoring case (when `enumCaseInsensitiveComparison: true`) |

## Combinator errors

| Code              | Message template                                        | Trigger                             |
| ----------------- | ------------------------------------------------------- | ----------------------------------- |
| `ANY_OF_MISSING`  | Data does not match any schemas from 'anyOf'            | No `anyOf` branch matched           |
| `ONE_OF_MISSING`  | Data does not match any schemas from 'oneOf'            | No `oneOf` branch matched           |
| `ONE_OF_MULTIPLE` | Data is valid against more than one schema from 'oneOf' | Multiple `oneOf` branches matched   |
| `NOT_PASSED`      | Data matches schema from 'not'                          | Data validated against `not` schema |

These errors produce nested sub-errors in `detail.inner`.

## Array errors

| Code                      | Message template                                 | Trigger                                                               |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `ARRAY_LENGTH_SHORT`      | Array is too short ({0}), minimum {1}            | Array length below `minItems`                                         |
| `ARRAY_LENGTH_LONG`       | Array is too long ({0}), maximum {1}             | Array length above `maxItems`                                         |
| `ARRAY_UNIQUE`            | Array items are not unique (indexes {0} and {1}) | `uniqueItems: true` violated                                          |
| `ARRAY_ADDITIONAL_ITEMS`  | Additional items not allowed                     | Extra items when `additionalItems: false`                             |
| `ARRAY_UNEVALUATED_ITEMS` | Unevaluated items are not allowed                | Extra items when `unevaluatedItems: false` or schema (draft-2019-09+) |

## Numeric errors

| Code                | Message template                                         | Trigger                        |
| ------------------- | -------------------------------------------------------- | ------------------------------ |
| `MULTIPLE_OF`       | Value {0} is not a multiple of {1}                       | `multipleOf` check failed      |
| `MINIMUM`           | Value {0} is less than minimum {1}                       | Below `minimum`                |
| `MINIMUM_EXCLUSIVE` | Value {0} is equal or less than exclusive minimum {1}    | At or below `exclusiveMinimum` |
| `MAXIMUM`           | Value {0} is greater than maximum {1}                    | Above `maximum`                |
| `MAXIMUM_EXCLUSIVE` | Value {0} is equal or greater than exclusive maximum {1} | At or above `exclusiveMaximum` |

## Object errors

| Code                               | Message template                                          | Trigger                                                                       |
| ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `OBJECT_PROPERTIES_MINIMUM`        | Too few properties defined ({0}), minimum {1}             | Below `minProperties`                                                         |
| `OBJECT_PROPERTIES_MAXIMUM`        | Too many properties defined ({0}), maximum {1}            | Above `maxProperties`                                                         |
| `OBJECT_MISSING_REQUIRED_PROPERTY` | Missing required property: {0}                            | Missing `required` property                                                   |
| `OBJECT_ADDITIONAL_PROPERTIES`     | Additional properties not allowed: {0}                    | Extra property with `additionalProperties: false`                             |
| `OBJECT_UNEVALUATED_PROPERTIES`    | Unevaluated properties are not allowed: {0}               | Extra property with `unevaluatedProperties: false` or schema (draft-2019-09+) |
| `OBJECT_DEPENDENCY_KEY`            | Dependency failed - key must exist: {0} (due to key: {1}) | `dependencies` key requirement not met                                        |

## String errors

| Code         | Message template                             | Trigger                        |
| ------------ | -------------------------------------------- | ------------------------------ |
| `MIN_LENGTH` | String is too short ({0} chars), minimum {1} | Below `minLength`              |
| `MAX_LENGTH` | String is too long ({0} chars), maximum {1}  | Above `maxLength`              |
| `PATTERN`    | String does not match pattern {0}: {1}       | `pattern` regex does not match |

## Schema validation errors

These are reported during `validateSchema()`, not during data validation.

| Code                           | Message template                                      | Trigger                                    |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------ |
| `KEYWORD_TYPE_EXPECTED`        | Keyword '{0}' is expected to be of type '{1}'         | Schema keyword has wrong type              |
| `KEYWORD_UNDEFINED_STRICT`     | Keyword '{0}' must be defined in strict mode          | Missing keyword when `strictMode: true`    |
| `KEYWORD_UNEXPECTED`           | Keyword '{0}' is not expected to appear in the schema | Extra keyword with `noExtraKeywords: true` |
| `KEYWORD_MUST_BE`              | Keyword '{0}' must be {1}                             | Keyword value out of specification         |
| `KEYWORD_DEPENDENCY`           | Keyword '{0}' requires keyword '{1}'                  | Missing dependent keyword                  |
| `KEYWORD_PATTERN`              | Keyword '{0}' is not a valid RegExp pattern: {1}      | Invalid regex in `pattern`                 |
| `KEYWORD_VALUE_TYPE`           | Each element of keyword '{0}' array must be a '{1}'   | Array keyword element has wrong type       |
| `UNKNOWN_FORMAT`               | There is no validation function for format '{0}'      | Format not registered and not built-in     |
| `CUSTOM_MODE_FORCE_PROPERTIES` | {0} must define at least one property if present      | `forceProperties: true` violated           |

## Reference and remote errors

| Code                              | Message template                                        | Trigger                              |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| `REF_UNRESOLVED`                  | Reference has not been resolved during compilation: {0} | `$ref` not resolved at compile time  |
| `UNRESOLVABLE_REFERENCE`          | Reference could not be resolved: {0}                    | `$ref` target not found              |
| `SCHEMA_NOT_REACHABLE`            | Validator was not able to read schema with uri: {0}     | Schema reader returned nothing       |
| `SCHEMA_TYPE_EXPECTED`            | Schema is expected to be of type 'object'               | Schema is not an object              |
| `SCHEMA_NOT_AN_OBJECT`            | Schema is not an object: {0}                            | Schema not an object (with value)    |
| `ASYNC_TIMEOUT`                   | {0} asynchronous task(s) have timed out after {1} ms    | Async format exceeded `asyncTimeout` |
| `PARENT_SCHEMA_VALIDATION_FAILED` | Schema failed to validate against its parent schema     | Meta-schema validation failed        |
| `REMOTE_NOT_VALID`                | Remote reference didn't compile successfully: {0}       | Remote schema failed compilation     |

## Draft-06+ errors

| Code              | Message template                                          | Trigger                                       |
| ----------------- | --------------------------------------------------------- | --------------------------------------------- |
| `SCHEMA_IS_FALSE` | Boolean schema "false" is always invalid                  | `false` used as a schema (draft-06+)          |
| `CONST`           | Value does not match const: {0}                           | `const` mismatch (draft-06+)                  |
| `CONTAINS`        | Array does not contain an item matching the schema        | `contains` not satisfied (draft-06+)          |
| `PROPERTY_NAMES`  | Property name {0} does not match the propertyNames schema | `propertyNames` validation failed (draft-06+) |

## Draft-2019-09+ errors

| Code                               | Message template                                                                           | Trigger                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `ARRAY_UNEVALUATED_ITEMS`          | Unevaluated items are not allowed                                                          | `unevaluatedItems` violated (draft-2019-09+)             |
| `OBJECT_UNEVALUATED_PROPERTIES`    | Unevaluated properties are not allowed: {0}                                                | `unevaluatedProperties` violated (draft-2019-09+)        |
| `COLLECT_EVALUATED_DEPTH_EXCEEDED` | Schema nesting depth exceeded maximum ({0}) during unevaluated items/properties collection | Recursion depth exceeded during `unevaluated*` traversal |

## Runtime safeguard errors

| Code                           | Message template                                                                                                                  | Trigger                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `MAX_RECURSION_DEPTH_EXCEEDED` | Maximum recursion depth ({0}) exceeded. If your schema or data is deeply nested and valid, increase the maxRecursionDepth option. | General recursion depth exceeded (configurable via `maxRecursionDepth` option, default 100) |

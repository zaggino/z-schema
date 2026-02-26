# Error Codes

All error codes are available in the `Errors` enum exported from `z-schema`.

## Type errors

| Code              | Message template                         |
| ----------------- | ---------------------------------------- |
| `INVALID_TYPE`    | Expected type {0} but found type {1}     |
| `SCHEMA_IS_FALSE` | Boolean schema "false" is always invalid |

## Enum / Const

| Code                 | Message template                  |
| -------------------- | --------------------------------- |
| `ENUM_MISMATCH`      | No enum match for: {0}            |
| `ENUM_CASE_MISMATCH` | Enum does not match case for: {0} |
| `CONST`              | Value does not match const: {0}   |

## Combinators

| Code              | Message template                                        |
| ----------------- | ------------------------------------------------------- |
| `ANY_OF_MISSING`  | Data does not match any schemas from 'anyOf'            |
| `ONE_OF_MISSING`  | Data does not match any schemas from 'oneOf'            |
| `ONE_OF_MULTIPLE` | Data is valid against more than one schema from 'oneOf' |
| `NOT_PASSED`      | Data matches schema from 'not'                          |

## Array errors

| Code                     | Message template                                   |
| ------------------------ | -------------------------------------------------- |
| `ARRAY_LENGTH_SHORT`     | Array is too short ({0}), minimum {1}              |
| `ARRAY_LENGTH_LONG`      | Array is too long ({0}), maximum {1}               |
| `ARRAY_UNIQUE`           | Array items are not unique (indexes {0} and {1})   |
| `ARRAY_ADDITIONAL_ITEMS` | Additional items not allowed                       |
| `CONTAINS`               | Array does not contain an item matching the schema |

## Numeric errors

| Code                | Message template                                         |
| ------------------- | -------------------------------------------------------- |
| `MULTIPLE_OF`       | Value {0} is not a multiple of {1}                       |
| `MINIMUM`           | Value {0} is less than minimum {1}                       |
| `MINIMUM_EXCLUSIVE` | Value {0} is equal or less than exclusive minimum {1}    |
| `MAXIMUM`           | Value {0} is greater than maximum {1}                    |
| `MAXIMUM_EXCLUSIVE` | Value {0} is equal or greater than exclusive maximum {1} |

## Object errors

| Code                               | Message template                                          |
| ---------------------------------- | --------------------------------------------------------- |
| `OBJECT_PROPERTIES_MINIMUM`        | Too few properties defined ({0}), minimum {1}             |
| `OBJECT_PROPERTIES_MAXIMUM`        | Too many properties defined ({0}), maximum {1}            |
| `OBJECT_MISSING_REQUIRED_PROPERTY` | Missing required property: {0}                            |
| `OBJECT_ADDITIONAL_PROPERTIES`     | Additional properties not allowed: {0}                    |
| `OBJECT_DEPENDENCY_KEY`            | Dependency failed - key must exist: {0} (due to key: {1}) |
| `PROPERTY_NAMES`                   | Property name {0} does not match the propertyNames schema |

## String errors

| Code         | Message template                             |
| ------------ | -------------------------------------------- |
| `MIN_LENGTH` | String is too short ({0} chars), minimum {1} |
| `MAX_LENGTH` | String is too long ({0} chars), maximum {1}  |
| `PATTERN`    | String does not match pattern {0}: {1}       |

## Format errors

| Code             | Message template                                  |
| ---------------- | ------------------------------------------------- |
| `INVALID_FORMAT` | Object didn't pass validation for format {0}: {1} |
| `UNKNOWN_FORMAT` | There is no validation function for format '{0}'  |

## Schema validation errors

| Code                           | Message template                                      |
| ------------------------------ | ----------------------------------------------------- |
| `KEYWORD_TYPE_EXPECTED`        | Keyword '{0}' is expected to be of type '{1}'         |
| `KEYWORD_UNDEFINED_STRICT`     | Keyword '{0}' must be defined in strict mode          |
| `KEYWORD_UNEXPECTED`           | Keyword '{0}' is not expected to appear in the schema |
| `KEYWORD_MUST_BE`              | Keyword '{0}' must be {1}                             |
| `KEYWORD_DEPENDENCY`           | Keyword '{0}' requires keyword '{1}'                  |
| `KEYWORD_PATTERN`              | Keyword '{0}' is not a valid RegExp pattern: {1}      |
| `KEYWORD_VALUE_TYPE`           | Each element of keyword '{0}' array must be a '{1}'   |
| `CUSTOM_MODE_FORCE_PROPERTIES` | {0} must define at least one property if present      |

## Remote / reference errors

| Code                     | Message template                                        |
| ------------------------ | ------------------------------------------------------- |
| `REF_UNRESOLVED`         | Reference has not been resolved during compilation: {0} |
| `UNRESOLVABLE_REFERENCE` | Reference could not be resolved: {0}                    |
| `SCHEMA_NOT_REACHABLE`   | Validator was not able to read schema with uri: {0}     |
| `SCHEMA_TYPE_EXPECTED`   | Schema is expected to be of type 'object'               |
| `SCHEMA_NOT_AN_OBJECT`   | Schema is not an object: {0}                            |
| `REMOTE_NOT_VALID`       | Remote reference didn't compile successfully: {0}       |

## Async errors

| Code            | Message template                                     |
| --------------- | ---------------------------------------------------- |
| `ASYNC_TIMEOUT` | {0} asynchronous task(s) have timed out after {1} ms |

## Meta-schema errors

| Code                              | Message template                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `PARENT_SCHEMA_VALIDATION_FAILED` | Schema failed to validate against its parent schema, see inner errors for details |

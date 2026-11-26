# Security considerations

General guidance for applications that validate input from sources they do not control. To report a suspected vulnerability, see [SECURITY.md](../SECURITY.md).

## Data and schemas are different kinds of input

The validator is built to check data from any source against a schema you chose. A schema is closer to code: it selects patterns to run, references to load and formats to call. Treat a schema from a source you do not control the way you would treat code from that source: review it, or restrict what it can use (see [Schema readers and remote references](#schema-readers-and-remote-references) and [Custom formats](#custom-formats)).

## Bound the input before validating

Validation time and memory grow with the size of the data, and validation recurses as deep as the data is nested. Check the size of the input at the boundary of your application, before calling `validate()`: a body-size limit in the HTTP layer, and limits on string length, array length and nesting where your parser offers them.

```javascript
const MAX_BODY_BYTES = 100_000;

if (rawBody.length > MAX_BODY_BYTES) {
  throw new Error('request body too large');
}
validator.validate(JSON.parse(rawBody), schema);
```

With the default [`sizeLimitsFirst`](options.md#sizelimitsfirst), a value that exceeds `maxLength`, `maxItems` or `maxProperties` is not checked further by the same schema object: a string skips `pattern`, `format` and the `content*` keywords, an array skips `uniqueItems`, `contains`, `unevaluatedItems` and its items (`items`, `prefixItems`, `additionalItems`), and an object skips `properties`, `patternProperties`, `additionalProperties`, `propertyNames`, `unevaluatedProperties` and its property values. The rule works per schema node: keywords in other subschemas of the same value (inside `allOf`, `anyOf`, `oneOf`, `if`, or the target of a `$ref` next to the limit) still run on it, and so do `enum` and `const`, so put the size limit in the same schema object as the keywords it should stop. Nothing is skipped when a `customValidator` is configured. A size keyword does not replace the check of the raw input size before parsing.

## Limits the library enforces

| Limit                                               | Default             | What it bounds                                                                                                      | When it is reached                                               |
| --------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`maxRecursionDepth`](options.md#maxrecursiondepth) | `100`               | Depth of the library's internal traversals of schemas and values (cloning, comparison, id and reference collection) | Validation fails with an error that names the recursion depth    |
| [`maxDataDepth`](options.md#maxdatadepth)           | `500`               | How deeply the validated data may be nested                                                                         | Validation fails with a `MAX_DATA_DEPTH_EXCEEDED` error          |
| [`asyncTimeout`](options.md#asynctimeout)           | `2000` ms           | How long a validation waits for pending async tasks (async formats); it does not interrupt synchronous work         | Validation fails with an `ASYNC_TIMEOUT` error                   |
| [`maxErrors`](options.md#maxerrors)                 | `1000`              | Number of error details one `validate()` call reports                                                               | Further details are left out and the error has `truncated: true` |
| Pattern length (a constant, not an option)          | `10 000` characters | Length of a `pattern` value or a `patternProperties` key                                                            | Schema validation fails                                          |

`maxRecursionDepth` is not a limit on how deeply the validated data may be nested; `maxDataDepth` is. It counts data levels, not stack frames: a schema with many nested applicators or `$ref` hops per level uses more of the call stack per level and may need a lower value than the default. With `maxDataDepth: Infinity`, very deep data is bounded only by the engine's call stack, so bound the nesting before validating.

## Patterns

`pattern` values and `patternProperties` keys run on the JavaScript regular-expression engine, and how long an expression takes depends on the expression and on the string. The library checks patterns before compiling them, but no such check can judge every expression. Review the patterns in schemas you do not control, and bound the length of the strings you validate.

## One validator instance per schema source

Use a separate instance for each independent source of schemas, and register the schemas they share when you create the instance:

```javascript
const tenantA = ZSchema.create();
const tenantB = ZSchema.create();

tenantA.setRemoteReference('http://example.com/common.json', commonSchema);
tenantB.setRemoteReference('http://example.com/common.json', commonSchema);

tenantA.validate(dataA, schemaFromA);
tenantB.validate(dataB, schemaFromB);
```

The static `ZSchema.setRemoteReference`, `ZSchema.registerFormat` and `ZSchema.setSchemaReader` are shared by every instance in the process. Use the instance methods for anything that belongs to one source. See [Remote References](usage.md#remote-references).

## Schema readers and remote references

A schema reader decides what a `$ref` to an unknown URI loads, and there is one reader per process. Return only schemas you intend to serve, for example from an allow-list keyed by URI. Do not turn the URI into a file path or a network request without checking it first.

```javascript
const allowed = new Map([
  ['http://example.com/address.json', addressSchema],
  ['http://example.com/person.json', personSchema],
]);

ZSchema.setSchemaReader((uri) => allowed.get(uri));
```

## Custom formats

A format function receives the value as it is in the data, whatever its type, and may be called more than once for the same value, so keep it free of side effects. Decide explicitly what it returns for values of another type, return a boolean, and handle errors inside the function.

```javascript
validator.registerFormat('postal-code', (value) => {
  if (typeof value !== 'string') {
    return true; // not a string: left to the `type` keyword
  }
  return /^\d{5}$/.test(value);
});
```

A format function decides validity only when formats are asserted; see [`formatAssertions`](options.md#formatassertions). See [features.md](features.md#register-a-custom-format) for the custom format reference.

## Command-line tool

The `z-schema` command loads the schemas that a schema references. Run it on schemas you trust, or in an environment where the files and hosts it can reach are the ones you intend. See [CLI](usage.md#cli).

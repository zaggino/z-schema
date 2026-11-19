# Security considerations

## Data and schemas are different kinds of input

The validator is built to check data from any source against a schema you chose. A schema is closer to code: it selects
patterns to run, references to load and formats to call. Treat a schema from a source you do not control the way you
would treat code from that source: review it, or restrict what it can use.

## Limits the library enforces

| Limit                | Default                         | What it bounds                                              |
| -------------------- | ------------------------------- | ----------------------------------------------------------- |
| `maxRecursionDepth`  | `100`                           | Nesting depth of the schemas and data the library traverses |
| `asyncTimeout`       | `2000` ms (clamped to `60 000`) | Total time for all async work in one validation             |
| `maxErrors`          | `1000`                          | Most error details one `validate()` call reports            |
| Pattern length limit | `10 000` characters             | Length of a `pattern` value (a constant, not an option)     |

- When `maxRecursionDepth` is reached, validation fails with a "Maximum recursion depth exceeded" error.
- When `asyncTimeout` is reached, validation fails with an `ASYNC_TIMEOUT` error.
- When `maxErrors` is reached, further details are left out and the error has `truncated: true`. `Infinity` turns the
  limit off. See [options.md](options.md#maxerrors).
- A `pattern` longer than the limit is reported as invalid.

See [options.md](options.md) for the full description of each option.

## Patterns

The library checks `pattern` values with a heuristic. It rejects some expressions that are slow to match and does not
recognise every one. If schemas come from a source you do not control, also bound the length of the strings you
validate: use `maxLength` in a schema you control, or a size check before validation.

```javascript
if (typeof input.name === 'string' && input.name.length > 256) {
  throw new Error('name too long');
}
validator.validate(input, schema);
```

## Bound the input before validating

Validation time and memory grow with the size of the data. Check the request body size, array lengths and nesting at the
boundary of your application (for example a body-size limit in the HTTP layer) before calling `validate()`.

## One validator instance per schema source

A validator instance keeps one registry of schema ids. Schemas registered with `setRemoteReference` or loaded by a schema
reader take precedence over ids that validated schemas declare, and ids declared by validated schemas share the
instance's registry. Use a separate instance for each independent source of schemas, and register shared schemas before
first use.

```javascript
const tenantA = ZSchema.create();
const tenantB = ZSchema.create();

tenantA.setRemoteReference('http://example.com/common.json', commonSchema);
tenantB.setRemoteReference('http://example.com/common.json', commonSchema);

tenantA.validate(dataA, schemaFromA);
tenantB.validate(dataB, schemaFromB);
```

## Schema readers and remote references

A `SchemaReader` decides what a `$ref` to an unknown URI loads. Return only schemas you intend to serve, for example from
an allow-list keyed by URI. Do not pass the URI to the filesystem or the network unchecked.

```javascript
const allowed = new Map([
  ['http://example.com/address.json', addressSchema],
  ['http://example.com/person.json', personSchema],
]);

ZSchema.setSchemaReader((uri) => allowed.get(uri));
```

See [usage.md](usage.md#remote-references) for the reader API.

## Custom formats

A format function receives the value as is, and its result decides validity. Check the value's type before using it,
resolve `false` for values you reject, and handle your own errors. A rejection counts as an invalid format, which makes
a schema under `not` pass. Keep the function free of effects that are unsafe to repeat.

```javascript
validator.registerFormat('postal-code', (value) => {
  if (typeof value !== 'string') return false;
  return /^\d{5}$/.test(value);
});
```

See [features.md](features.md#register-a-custom-format) for the custom format reference.

## Command-line tool

A file `$ref` is read only inside the schema file's directory, unless `--refRoot <dir>` names a wider directory.
`https:` references are downloaded with a size limit and a deadline. Other schemes are not read. See
[usage.md](usage.md#references).

## Reporting

To report a suspected vulnerability, see [SECURITY.md](../SECURITY.md).

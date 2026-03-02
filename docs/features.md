# Features

z-schema provides full support for JSON Schema **draft-04**, **draft-06**, **draft-07**, **draft-2019-09**, and **draft-2020-12** (latest), with a rich set of configuration options and extensibility hooks.

- [Validate against subschema](#validate-against-subschema)
- [Compile arrays of schemas and use references between them](#compile-arrays-of-schemas-and-use-references-between-them)
- [Compile-to-function API](#compile-to-function-api)
- [Register a custom format](#register-a-custom-format)
- [Automatic downloading of remote schemas](#automatic-downloading-of-remote-schemas)
- [Prefill default values to object using format](#prefill-default-values-to-object-using-format)
- [Define a custom timeout for all async operations](options.md#asynctimeout)
- [Disallow validation of empty arrays as arrays](options.md#noemptyarrays)
- [Disallow validation of empty strings as strings](options.md#noemptystrings)
- [Disallow schemas that don't have a type specified](options.md#notypeless)
- [Disallow schemas that contain unrecognized keywords](options.md#noextrakeywords)
- [Assume additionalItems/additionalProperties are false](options.md#assumeadditional)
- [Force additionalItems/additionalProperties to be defined](options.md#forceadditional)
- [Force items to be defined in array type schemas](options.md#forceitems)
- [Force minItems to be defined in array type schemas](options.md#forceminitems)
- [Force maxItems to be defined in array type schemas](options.md#forcemaxitems)
- [Force minLength to be defined in string type schemas](options.md#forceminlength)
- [Force maxLength to be defined in string type schemas](options.md#forcemaxlength)
- [Force properties or patternProperties to be defined in object type schemas](options.md#forceproperties)
- [Ignore unresolvable remote references](options.md#ignoreunresolvablereferences)
- [Case-insensitive enum comparison](options.md#enumcaseinsensitivecomparison)
- [Strict absolute URIs only](options.md#stricturis)
- [Strict mode](options.md#strictmode)
- [Format assertion toggle](options.md#formatassertions)
- [Stop on first error](options.md#breakonfirsterror)
- [Report paths as arrays](options.md#reportpathasarray)
- [Unicode Property Escapes Support](#unicode-property-escapes-support)
- [Keyword field](#keyword-field)
- [unevaluatedProperties / unevaluatedItems](#unevaluatedproperties--unevaluateditems)

## Validate against subschema

You can validate against a specific part of a schema using the `schemaPath` option:

```javascript
try {
  validator.validate(cars, schema, { schemaPath: 'definitions.car.definitions.cars' });
  // validation passed
} catch (error) {
  // handle validation error
}
```

## Compile arrays of schemas and use references between them

You can compile an array of schemas that reference each other, then validate against any of them:

```javascript
const schemas = [
  {
    id: 'personDetails',
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    },
    required: ['firstName', 'lastName'],
  },
  {
    id: 'addressDetails',
    type: 'object',
    properties: {
      street: { type: 'string' },
      city: { type: 'string' },
    },
    required: ['street', 'city'],
  },
  {
    id: 'personWithAddress',
    allOf: [{ $ref: 'personDetails' }, { $ref: 'addressDetails' }],
  },
];

const data = {
  firstName: 'Martin',
  lastName: 'Zagora',
  street: 'George St',
  city: 'Sydney',
};

const validator = ZSchema.create();

// compile & validate schemas first
validator.validateSchema(schemas);

// now validate data against the compiled schema
validator.validate(data, schemas[2]);
```

## Compile-to-function API

z-schema includes `ZSchemaCompiler` for compile-to-function workflows:

```typescript
import { ZSchemaCompiler } from 'z-schema';

const compiler = new ZSchemaCompiler();
const validate = compiler.compile({ type: 'object', required: ['name'] });

try {
  validate({}); // throws on error by default, doesn't throw when safe:true is set
} catch (err) {
  console.log(err); // error object
}
```

### Combined async + safe

Both options can be combined. The return type of `compile()` is automatically inferred — no type casting needed:

```typescript
import { ZSchemaCompiler } from 'z-schema';

const compiler = new ZSchemaCompiler({ async: true, safe: true });
const validate = compiler.compile({ type: 'object', required: ['name'] });
//    ^? AsyncSafeValidateFunction — inferred from { async: true, safe: true }
const result = await validate(data); // { valid: boolean, err?: ValidateError }
```

## Register a custom format

Register a sync format validator (must return a boolean):

```javascript
ZSchema.registerFormat('xstring', (str) => {
  return str === 'xxx';
});
```

Register an async format validator (return a `Promise<boolean>`). Requires using async validation mode:

```javascript
ZSchema.registerFormat('xstring', async (str) => {
  await someAsyncCheck(str);
  return str === 'xxx';
});
```

The default timeout for async format validation is 2000ms, configurable per instance:

```javascript
const validator = ZSchema.create({ asyncTimeout: 5000 });
```

### List registered formats

```javascript
const registeredFormats = ZSchema.getRegisteredFormats();
// returns an array of all globally registered format names
```

## Automatic downloading of remote schemas

Automatic downloading of remote schemas was removed from version `3.x` but is still possible with `ZSchema.setSchemaReader`. See the [usage guide](usage.md#remote-references) for details.

## Prefill default values to object using format

Using format validators, you can pre-fill values into objects:

```javascript
ZSchema.registerFormat('fillHello', (obj) => {
  obj.hello = 'world';
  return true;
});

const data = {};
const schema = { type: 'object', format: 'fillHello' };

validator.validate(data, schema);
// data.hello === 'world'
```

## Unicode Property Escapes Support

Fully supports [Unicode property escapes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Unicode_property_escapes) in JSON Schema `pattern` values (e.g., `\p{L}`). This allows patterns that match Unicode character properties such as letters, numbers, or scripts, in any JavaScript environment that supports them (Node.js >= 10, all modern browsers).

```json
{
  "type": "string",
  "pattern": "^\\p{L}+$"
}
```

z-schema automatically uses the `u` (Unicode) flag for patterns containing Unicode property escapes. If your environment does not support them, such patterns are reported as invalid.

## Keyword field

Error details include a `keyword` field indicating which schema keyword triggered the error (for example: `"required"`, `"type"`, `"minLength"`).

```json
{
  "message": "Missing required property",
  "code": "OBJECT_MISSING_REQUIRED_PROPERTY",
  "params": ["name"],
  "path": "#/",
  "keyword": "required"
}
```

## unevaluatedProperties / unevaluatedItems

Full annotation-based support for `unevaluatedProperties` (draft-2019-09+) and `unevaluatedItems` (draft-2019-09+), including:

- **Schema-valued** `unevaluatedProperties` / `unevaluatedItems` (not just `false` — unevaluated entries are validated against the provided schema)
- **Applicator traversal**: annotations are collected through `allOf`, `anyOf` (matching branches only), `oneOf` (matching branches only), `if`/`then`/`else` (condition-dependent), `dependentSchemas`, and `$ref`
- **`contains` interaction** (draft-2020-12): items matching a `contains` schema are considered evaluated for `unevaluatedItems`
- **Dynamic references**: `$recursiveRef`/`$recursiveAnchor` (draft-2019-09) and `$dynamicRef`/`$dynamicAnchor` (draft-2020-12) are resolved dynamically using scope stacks
- **Cousin isolation**: `unevaluatedProperties`/`unevaluatedItems` inside a sub-schema (e.g., `allOf[1]`) only sees annotations from its own schema scope, not from sibling applicators
- **Boolean schemas**: `true` as a sub-schema validates all data but does not mark any properties or items as evaluated
- **`additionalProperties`** tracking: when present (as `true` or a schema), marks all non-`properties`/non-`patternProperties` keys as evaluated

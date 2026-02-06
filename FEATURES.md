## Features

- [Validate against subschema](#validate-against-subschema)
- [Compile arrays of schemas and use references between them](#compile-arrays-of-schemas-and-use-references-between-them)
- [Register a custom format](#register-a-custom-format)
- [Automatic downloading of remote schemas](#automatic-downloading-of-remote-schemas)
- [Prefill default values to object using format](#prefill-default-values-to-object-using-format)
- [Define a custom timeout for all async operations](OPTIONS.md#asynctimeout)
- [Disallow validation of empty arrays as arrays](OPTIONS.md#noemptyarrays)
- [Disallow validation of empty strings as strings](OPTIONS.md#noemptystrings)
- [Disallow schemas that don't have a type specified](OPTIONS.md#notypeless)
- [Disallow schemas that contain unrecognized keywords and are not validated by parent schemas](OPTIONS.md#noextrakeywords)
- [Assume additionalItems/additionalProperties are defined in schemas as false](OPTIONS.md#assumeadditional)
- [Force additionalItems/additionalProperties to be defined in schemas](OPTIONS.md#forceadditional)
- [Force items to be defined in array type schemas](OPTIONS.md#forceitems)
- [Force minItems to be defined in array type schemas](OPTIONS.md#forceminitems)
- [Force maxItems to be defined in array type schemas](OPTIONS.md#forcemaxitems)
- [Force minLength to be defined in string type schemas](OPTIONS.md#forceminlength)
- [Force maxLength to be defined in string type schemas](OPTIONS.md#forcemaxlength)
- [Force properties or patternProperties to be defined in object type schemas](OPTIONS.md#forceproperties)
- [Ignore remote references to schemas that are not cached or resolvable](OPTIONS.md#ignoreunresolvablereferences)
- [Ignore case mismatch when validating enum values](OPTIONS.md#enumCaseInsensitiveComparison)
- [Only allow strictly absolute URIs to be used in schemas](OPTIONS.md#stricturis)
- [Turn on z-schema strict mode](OPTIONS.md#strictmode)
- [Set validator to collect as many errors as possible](OPTIONS.md#breakonfirsterror)
- [Report paths in errors as arrays so they can be processed easier](OPTIONS.md#reportpathasarray)
- [Unicode Property Escapes Support](#unicode-property-escapes-support)
- [Keyword field](#keyword-field)

### Validate against subschema

In case you don't want to split your schema into multiple schemas using reference for any reason, you can use option schemaPath when validating:

```javascript
try {
  validator.validate(cars, schema, { schemaPath: 'definitions.car.definitions.cars' });
  // validation passed
} catch (error) {
  // handle validation error
}
```

See more details in the [test](/test/spec/schemaPathSpec.js).

### Compile arrays of schemas and use references between them

You can use validator to compile an array of schemas that have references between them and then validate against one of those schemas:

```javascript
var schemas = [
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

var data = {
  firstName: 'Martin',
  lastName: 'Zagora',
  street: 'George St',
  city: 'Sydney',
};

var validator = ZSchema.create();

// compile & validate schemas first, z-schema will automatically handle array
var allSchemasValid = validator.validateSchema(schemas);
// allSchemasValid === true

// now validate our data against the last schema
try {
  validator.validate(data, schemas[2]);
  // validation passed
} catch (error) {
  // handle validation error
}
```

## Register a custom format

You can register any format of your own. Your sync validator function should always respond with a boolean:

```javascript
ZSchema.registerFormat('xstring', function (str) {
  return str === 'xxx';
});
```

Async format validators are also supported, they should accept two arguments, value and a callback to which they need to respond:

```javascript
ZSchema.registerFormat('xstring', function (str, callback) {
  setTimeout(function () {
    callback(str === 'xxx');
  }, 1);
});
```

Alternatively, async format validators can return a Promise that resolves to a boolean:

```javascript
ZSchema.registerFormat('xstring', async function (str) {
  // Simulate async operation
  await someAsyncCheck(str);
  return str === 'xxx';
});
```

The default timeout for async format validation is 2000ms and can be configured per validator instance:

```javascript
const validator = ZSchema.create({ asyncTimeout: 5000 }); // 5 second timeout
```

### Helper method to check the formats that have been registered

```javascript
var registeredFormats = ZSchema.getRegisteredFormats();
//registeredFormats will now contain an array of all formats that have been registered with z-schema
```

### Automatic downloading of remote schemas

Automatic downloading of remote schemas was removed from version `3.x` but is still possible with a bit of extra code,
see [this test](test/spec/AutomaticSchemaLoadingSpec.js) for more information on this.

### Prefill default values to object using format

Using format, you can pre-fill values of your choosing into the objects like this:

```javascript
ZSchema.registerFormat('fillHello', function (obj) {
  obj.hello = 'world';
  return true;
});

var data = {};

var schema = {
  type: 'object',
  format: 'fillHello',
};

validator.validate(data, schema);
// data.hello === "world"
```

### Unicode Property Escapes Support

Fully supports [Unicode property escapes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Unicode_property_escapes) in JSON Schema `pattern` values (e.g., `/\p{L}/u`). This allows you to write patterns that match Unicode character properties, such as letters, numbers, or scripts, provided your JavaScript environment supports them (Node.js ≥ 10, all modern browsers).

**Example:**

```json
{
  "type": "string",
  "pattern": "^\\p{L}+$" // matches only Unicode letters
}
```

z-schema will automatically use the `u` (Unicode) flag for all patterns containing Unicode property escapes, both in Node.js and browser environments. If your environment does not support Unicode property escapes, such patterns will be reported as invalid.

### Keyword field

Error objects returned by `getLastErrors()` (and included on the `details` property of `getLastError()`'s Error) include a `keyword` field indicating the schema keyword that triggered the error (for example: `"required"`, `"type"`, `"minLength"`).

Example error detail:

```json
{
  "message": "Missing required property",
  "code": "OBJECT_MISSING_REQUIRED_PROPERTY",
  "params": ["name"],
  "path": "#/",
  "schemaId": "http://example.com/schema",
  "keyword": "required"
}
```

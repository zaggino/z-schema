## Options

### asyncTimeout

Defines a time limit, which should be used when waiting for async tasks like async format validators to perform their validation,
before the validation fails with an `ASYNC_TIMEOUT` error.

```javascript
var validator = new ZSchema({
  asyncTimeout: 2000,
});
```

### excludeErrors

An array of error codes to exclude from validation reports. When specified, any errors with matching codes will be filtered out from the report, allowing you to suppress specific validation errors while keeping others.

```javascript
var validator = new ZSchema({
  excludeErrors: ['MIN_LENGTH', 'MINIMUM'],
});

var report = validator.validate(data, schema, { excludeErrors: ['MAX_LENGTH'] });
```

### noEmptyArrays

When true, validator will assume that minimum count of items in any `array` is 1, except when `minItems: 0` is explicitly defined.

```javascript
var validator = new ZSchema({
  noEmptyArrays: true,
});
```

### noEmptyStrings

When true, validator will assume that minimum length of any string to pass type `string` validation is 1, except when `minLength: 0` is explicitly defined.

```javascript
var validator = new ZSchema({
  noEmptyStrings: true,
});
```

### noTypeless

When true, validator will fail validation for schemas that don't specify a `type` of object that they expect.

```javascript
var validator = new ZSchema({
  noTypeless: true,
});
```

### noExtraKeywords

When true, validator will fail for schemas that use keywords not defined in JSON Schema specification and doesn't provide a parent schema in `$schema` property to validate the schema.

```javascript
var validator = new ZSchema({
  noExtraKeywords: true,
});
```

### assumeAdditional

When true, validator assumes that additionalItems/additionalProperties are defined as false so you don't have to manually fix all your schemas.

```javascript
var validator = new ZSchema({
  assumeAdditional: true,
});
```

When an array, validator assumes that additionalItems/additionalProperties are defined as false, but allows some properties to pass.

```javascript
var validator = new ZSchema({
  assumeAdditional: ['$ref'],
});
```

### forceAdditional

When true, validator doesn't validate schemas where additionalItems/additionalProperties should be defined to either true or false.

```javascript
var validator = new ZSchema({
  forceAdditional: true,
});
```

### forceItems

When true, validator doesn't validate schemas where `items` are not defined for `array` type schemas.
This is to avoid passing anything through an array definition.

```javascript
var validator = new ZSchema({
  forceItems: true,
});
```

### forceMinItems

When true, validator doesn't validate schemas where `minItems` is not defined for `array` type schemas.
This is to avoid passing zero-length arrays which application doesn't expect to handle.

```javascript
var validator = new ZSchema({
  forceMinItems: true,
});
```

### forceMaxItems

When true, validator doesn't validate schemas where `maxItems` is not defined for `array` type schemas.
This is to avoid passing arrays with unlimited count of elements which application doesn't expect to handle.

```javascript
var validator = new ZSchema({
  forceMaxItems: true,
});
```

### forceMinLength

When true, validator doesn't validate schemas where `minLength` is not defined for `string` type schemas.
This is to avoid passing zero-length strings which application doesn't expect to handle.

```javascript
var validator = new ZSchema({
  forceMinLength: true,
});
```

### forceMaxLength

When true, validator doesn't validate schemas where `maxLength` is not defined for `string` type schemas.
This is to avoid passing extremly large strings which application doesn't expect to handle.

```javascript
var validator = new ZSchema({
  forceMaxLength: true,
});
```

### forceProperties

When true, validator doesn't validate schemas where `properties` or `patternProperties` is not defined for `object` type schemas.
This is to avoid having objects with unexpected properties in application.

```javascript
var validator = new ZSchema({
  forceProperties: true,
});
```

### ignoreUnresolvableReferences

When true, validator doesn't end with error when a remote reference is unreachable. **This setting is not recommended in production outside of testing.**

```javascript
var validator = new ZSchema({
  ignoreUnresolvableReferences: true,
});
```

### enumCaseInsensitiveComparison

When true, validator will return a `ENUM_CASE_MISMATCH` when the enum values mismatch only in case.

```javascript
var validator = new ZSchema({
  enumCaseInsensitiveComparison: true,
});
```

### strictUris

When true, all strings of format `uri` must be an absolute URIs and not only URI references. See more details in [this issue](https://github.com/zaggino/z-schema/issues/18).

```javascript
var validator = new ZSchema({
  strictUris: true,
});
```

### strictMode

Strict mode of z-schema is currently equal to the following:

```javascript
if (this.options.strictMode === true) {
  this.options.forceAdditional = true;
  this.options.forceItems = true;
  this.options.forceMaxLength = true;
  this.options.forceProperties = true;
  this.options.noExtraKeywords = true;
  this.options.noTypeless = true;
  this.options.noEmptyStrings = true;
  this.options.noEmptyArrays = true;
}
```

```javascript
var validator = new ZSchema({
  strictMode: true,
});
```

### breakOnFirstError

default: `false`<br />
When true, will stop validation after the first error is found:

```javascript
var validator = new ZSchema({
  breakOnFirstError: true,
});
```

### reportPathAsArray

Report error paths as an array of path segments instead of a string:

```javascript
var validator = new ZSchema({
  reportPathAsArray: true,
});
```

### ignoreUnknownFormats

By default, z-schema reports all unknown formats, formats not defined by JSON Schema and not registered using
`ZSchema.registerFormat`, as an error. But the
[JSON Schema specification](http://json-schema.org/latest/json-schema-validation.html#anchor106) says that validator
implementations _"they SHOULD offer an option to disable validation"_ for `format`. That being said, setting this
option to `true` will disable treating unknown formats as errlrs

```javascript
var validator = new ZSchema({
  ignoreUnknownFormats: true,
});
```

### includeErrors

By default, z-schema reports all errors. If interested only in a subset of the errors, passing the option `includeErrors` to `validate` will perform validations only for those errors.

```javascript
var validator = new ZSchema();
// will only execute validation for "INVALID_TYPE" error.
validator.validate(json, schema, { includeErrors: ['INVALID_TYPE'] });
```

### customValidator

**Warning**: Use only if know what you are doing. Always consider using [custom format](FEATURES.md#register-a-custom-format) before using this option.

Register function to be called as part of validation process on every subshema encounter during validation.

Let's make a real-life example with this feature.
Imagine you have number of transactions:

```json
{
  "fromId": 1034834329,
  "toId": 1034834543,
  "amount": 200
}
```

So you write the schema:

```json
{
  "type": "object",
  "properties": {
    "fromId": {
      "type": "integer"
    },
    "toId": {
      "type": "integer"
    },
    "amount": {
      "type": "number"
    }
  }
}
```

But how to check that `fromId` and `toId` are never equal.
In JSON Schema Draft4 there is no possibility to do this.
Actually, it's easy to just write validation code for such simple payloads.
But what if you have to do the same check for many objects in different places of JSON payload.
One solution is to add custom keyword `uniqueProperties` with array of property names as a value. So in our schema we would need to add:

```json
"uniqueProperties": [
    "fromId",
    "toId"
]
```

To teach `z-schema` about this new keyword we need to write handler for it:

```javascript
function customValidatorFn(report, schema, json) {
  // check if our custom property is present
  if (Array.isArray(schema.uniqueProperties)) {
    var seenValues = [];
    schema.uniqueProperties.forEach(function (prop) {
      var value = json[prop];
      if (typeof value !== 'undefined') {
        if (seenValues.indexOf(value) !== -1) {
          // report error back to z-schema core
          report.addCustomError(
            'NON_UNIQUE_PROPERTY_VALUE',
            'Property "{0}" has non-unique value: {1}',
            [prop, value],
            null,
            schema.description
          );
        }
        seenValues.push(value);
      }
    });
  }
}

var validator = new ZSchema({
  // register our custom validator inside z-schema
  customValidator: customValidatorFn,
});
```

Let's test it:

```javascript
var data = {
  fromId: 1034834346,
  toId: 1034834346,
  amount: 50,
};

validator.validate(data, schema);
console.log(validator.getLastErrors());
//[ { code: 'NON_UNIQUE_PROPERTY_VALUE',
//    params: [ 'toId', 1034834346 ],
//    message: 'Property "toId" has non-unique value: 1034834346',
//    path: '#/',
//    schemaId: undefined } ]
```

**Note:** before creating your own keywords you should consider all compatibility issues.

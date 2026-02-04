# z-schema - a JSON Schema validator

[![NPM](https://nodei.co/npm/z-schema.png?downloads=true&downloadRank=true)](https://www.npmjs.com/package/z-schema)

[![coverage status](https://coveralls.io/repos/zaggino/z-schema/badge.svg)](https://coveralls.io/r/zaggino/z-schema)

## Topics

- [What](#what)
- [Versions](#versions)
- [Usage](#usage)
- [Features](#features)
- [Options](#options)
- [Contributing](#contributing)
- [Contributors](#contributors)

## What

What is a JSON Schema? Find here: [https://json-schema.org/](https://json-schema.org/)

## Versions

v6 - old version which has been around a long time, supports JSON Schema Draft 04
v7 - updated version (to ESM module with Typescript) which passes all tests from JSON Schema Test Suite for Draft 04

## Usage

Validator will try to perform sync validation when possible for speed, but supports async callbacks when they are necessary.

### ESM and Typescript:

```javascript
import ZSchema from 'z-schema';
const validator = new ZSchema();
console.log(validator.validate(1, { type: 'number' })); // true
console.log(validator.validate(1, { type: 'string' })); // false
```

### CommonJs:

```javascript
const ZSchema = require('z-schema');
const validator = new ZSchema();
console.log(validator.validate(1, { type: 'number' })); // true
console.log(validator.validate(1, { type: 'string' })); // false
```

### CLI:

```bash
npm install --global z-schema
z-schema --help
z-schema mySchema.json
z-schema mySchema.json myJson.json
z-schema --strictMode mySchema.json myJson.json
```

### Sync mode:

```javascript
var valid = validator.validate(json, schema);
// this will return a native error object with name and message
var error = validator.getLastError();
// this will return an array of validation errors encountered
var errors = validator.getLastErrors();
...
```

### Async mode:

```javascript
validator.validate(json, schema, function (err, valid) {
    ...
});
```

### Browser:

```html
<script type="text/javascript" src="z-schema/umd/ZSchema.min.js"></script>
<script type="text/javascript">
  var validator = new ZSchema();
  console.log(validator.validate('string', { type: 'string' }));
</script>
```

### Remote references and schemas:

In case you have some remote references in your schemas, you have to download those schemas before using validator.
Otherwise you'll get `UNRESOLVABLE_REFERENCE` error when trying to compile a schema.

```javascript
var validator = new ZSchema();
var json = {};
var schema = { "$ref": "http://json-schema.org/draft-04/schema#" };

var valid = validator.validate(json, schema);
var errors = validator.getLastErrors();
// valid === false
// errors.length === 1
// errors[0].code === "UNRESOLVABLE_REFERENCE"

var requiredUrl = "http://json-schema.org/draft-04/schema";
request(requiredUrl, function (error, response, body) {

    validator.setRemoteReference(requiredUrl, JSON.parse(body));

    var valid = validator.validate(json, schema);
    var errors = validator.getLastErrors();
    // valid === true
    // errors === undefined

}
```

If you're able to load schemas synchronously, you can use `ZSchema.setSchemaReader` feature:

```javascript
ZSchema.setSchemaReader(function (uri) {
  var someFilename = path.resolve(__dirname, '..', 'schemas', uri + '.json');
  return JSON.parse(fs.readFileSync(someFilename, 'utf8'));
});
```

## Features

- [Validate against subschema](#validate-against-subschema)
- [Compile arrays of schemas and use references between them](#compile-arrays-of-schemas-and-use-references-between-them)
- [Register a custom format](#register-a-custom-format)
- [Automatic downloading of remote schemas](#automatic-downloading-of-remote-schemas)
- [Prefill default values to object using format](#prefill-default-values-to-object-using-format)
- [Define a custom timeout for all async operations](#asynctimeout)
- [Disallow validation of empty arrays as arrays](#noemptyarrays)
- [Disallow validation of empty strings as strings](#noemptystrings)
- [Disallow schemas that don't have a type specified](#notypeless)
- [Disallow schemas that contain unrecognized keywords and are not validated by parent schemas](#noextrakeywords)
- [Assume additionalItems/additionalProperties are defined in schemas as false](#assumeadditional)
- [Force additionalItems/additionalProperties to be defined in schemas](#forceadditional)
- [Force items to be defined in array type schemas](#forceitems)
- [Force minItems to be defined in array type schemas](#forceminitems)
- [Force maxItems to be defined in array type schemas](#forcemaxitems)
- [Force minLength to be defined in string type schemas](#forceminlength)
- [Force maxLength to be defined in string type schemas](#forcemaxlength)
- [Force properties or patternProperties to be defined in object type schemas](#forceproperties)
- [Ignore remote references to schemas that are not cached or resolvable](#ignoreunresolvablereferences)
- [Ignore case mismatch when validating enum values](#enumCaseInsensitiveComparison)
- [Only allow strictly absolute URIs to be used in schemas](#stricturis)
- [Turn on z-schema strict mode](#strictmode)
- [Set validator to collect as many errors as possible](#breakonfirsterror)
- [Report paths in errors as arrays so they can be processed easier](#reportpathasarray)
- [Unicode Property Escapes Support](#unicode-property-escapes-support)

### Validate against subschema

In case you don't want to split your schema into multiple schemas using reference for any reason, you can use option schemaPath when validating:

```javascript
var valid = validator.validate(cars, schema, { schemaPath: 'definitions.car.definitions.cars' });
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

var validator = new ZSchema();

// compile & validate schemas first, z-schema will automatically handle array
var allSchemasValid = validator.validateSchema(schemas);
// allSchemasValid === true

// now validate our data against the last schema
var valid = validator.validate(data, schemas[2]);
// valid === true
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

## Options

### asyncTimeout

Defines a time limit, which should be used when waiting for async tasks like async format validators to perform their validation,
before the validation fails with an `ASYNC_TIMEOUT` error.

```javascript
var validator = new ZSchema({
  asyncTimeout: 2000,
});
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

**Warning**: Use only if know what you are doing. Always consider using [custom format](#register-a-custom-format) before using this option.

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

## Contributing:

These repository has several submodules and should be cloned as follows:

> git clone **--recursive** https://github.com/zaggino/z-schema.git

## Contributors

Thanks for contributing to:

<!-- readme: contributors -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/zaggino">
                    <img src="https://avatars.githubusercontent.com/u/1067319?v=4" width="100;" alt="zaggino"/>
                    <br />
                    <sub><b>Martin Zagora</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/sergey-shandar">
                    <img src="https://avatars.githubusercontent.com/u/902339?v=4" width="100;" alt="sergey-shandar"/>
                    <br />
                    <sub><b>Sergey Shandar</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/IvanGoncharov">
                    <img src="https://avatars.githubusercontent.com/u/8336157?v=4" width="100;" alt="IvanGoncharov"/>
                    <br />
                    <sub><b>Ivan Goncharov</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/pgonzal">
                    <img src="https://avatars.githubusercontent.com/u/47177787?v=4" width="100;" alt="pgonzal"/>
                    <br />
                    <sub><b>Pete Gonzalez (OLD ALIAS)</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/simon-p-r">
                    <img src="https://avatars.githubusercontent.com/u/4668724?v=4" width="100;" alt="simon-p-r"/>
                    <br />
                    <sub><b>Simon R</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/TheToolbox">
                    <img src="https://avatars.githubusercontent.com/u/2837017?v=4" width="100;" alt="TheToolbox"/>
                    <br />
                    <sub><b>Jason Oettinger</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/whitlockjc">
                    <img src="https://avatars.githubusercontent.com/u/98899?v=4" width="100;" alt="whitlockjc"/>
                    <br />
                    <sub><b>Jeremy Whitlock</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/epoberezkin">
                    <img src="https://avatars.githubusercontent.com/u/2769109?v=4" width="100;" alt="epoberezkin"/>
                    <br />
                    <sub><b>Evgeny</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/toofishes">
                    <img src="https://avatars.githubusercontent.com/u/265817?v=4" width="100;" alt="toofishes"/>
                    <br />
                    <sub><b>Dan McGee</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/antialias">
                    <img src="https://avatars.githubusercontent.com/u/447517?v=4" width="100;" alt="antialias"/>
                    <br />
                    <sub><b>Thomas Hallock</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/kallaspriit">
                    <img src="https://avatars.githubusercontent.com/u/277993?v=4" width="100;" alt="kallaspriit"/>
                    <br />
                    <sub><b>Priit Kallas</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/santam85">
                    <img src="https://avatars.githubusercontent.com/u/2706307?v=4" width="100;" alt="santam85"/>
                    <br />
                    <sub><b>Marco Santarelli</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/Hirse">
                    <img src="https://avatars.githubusercontent.com/u/2564094?v=4" width="100;" alt="Hirse"/>
                    <br />
                    <sub><b>Jan Pilzer</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/geraintluff">
                    <img src="https://avatars.githubusercontent.com/u/1957191?v=4" width="100;" alt="geraintluff"/>
                    <br />
                    <sub><b>Geraint</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/dgerber">
                    <img src="https://avatars.githubusercontent.com/u/393344?v=4" width="100;" alt="dgerber"/>
                    <br />
                    <sub><b>Daniel Gerber</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/addaleax">
                    <img src="https://avatars.githubusercontent.com/u/899444?v=4" width="100;" alt="addaleax"/>
                    <br />
                    <sub><b>Anna Henningsen</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/mctep">
                    <img src="https://avatars.githubusercontent.com/u/1949681?v=4" width="100;" alt="mctep"/>
                    <br />
                    <sub><b>Konstantin Vasilev</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/barrtender">
                    <img src="https://avatars.githubusercontent.com/u/3101221?v=4" width="100;" alt="barrtender"/>
                    <br />
                    <sub><b>barrtender</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/RomanHotsiy">
                    <img src="https://avatars.githubusercontent.com/u/3975738?v=4" width="100;" alt="RomanHotsiy"/>
                    <br />
                    <sub><b>Roman Hotsiy</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/sauvainr">
                    <img src="https://avatars.githubusercontent.com/u/1715747?v=4" width="100;" alt="sauvainr"/>
                    <br />
                    <sub><b>RenaudS</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/figadore">
                    <img src="https://avatars.githubusercontent.com/u/3253971?v=4" width="100;" alt="figadore"/>
                    <br />
                    <sub><b>Reese</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/MattiSG">
                    <img src="https://avatars.githubusercontent.com/u/222463?v=4" width="100;" alt="MattiSG"/>
                    <br />
                    <sub><b>Matti Schneider</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/sandersky">
                    <img src="https://avatars.githubusercontent.com/u/422902?v=4" width="100;" alt="sandersky"/>
                    <br />
                    <sub><b>Matthew Dahl</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/jfromaniello">
                    <img src="https://avatars.githubusercontent.com/u/178512?v=4" width="100;" alt="jfromaniello"/>
                    <br />
                    <sub><b>José F. Romaniello</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/KEIII">
                    <img src="https://avatars.githubusercontent.com/u/1167833?v=4" width="100;" alt="KEIII"/>
                    <br />
                    <sub><b>Ivan Kasenkov</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/HanOterLin">
                    <img src="https://avatars.githubusercontent.com/u/21137108?v=4" width="100;" alt="HanOterLin"/>
                    <br />
                    <sub><b>Tony Lin</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/domoritz">
                    <img src="https://avatars.githubusercontent.com/u/589034?v=4" width="100;" alt="domoritz"/>
                    <br />
                    <sub><b>Dominik Moritz</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Semigradsky">
                    <img src="https://avatars.githubusercontent.com/u/1198848?v=4" width="100;" alt="Semigradsky"/>
                    <br />
                    <sub><b>Dmitry Semigradsky</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/countcain">
                    <img src="https://avatars.githubusercontent.com/u/1751150?v=4" width="100;" alt="countcain"/>
                    <br />
                    <sub><b>Tao Huang</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/BuBuaBu">
                    <img src="https://avatars.githubusercontent.com/u/3825745?v=4" width="100;" alt="BuBuaBu"/>
                    <br />
                    <sub><b>BuBuaBu</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: contributors -end -->

and to everyone submitting [issues](https://github.com/zaggino/z-schema/issues) on GitHub

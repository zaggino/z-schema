#z-schema validator

[![npm version](https://badge.fury.io/js/z-schema.png)](http://badge.fury.io/js/z-schema)
[![build status](https://travis-ci.org/zaggino/z-schema.svg?branch=master)](https://travis-ci.org/zaggino/z-schema)

[![browser support](https://ci.testling.com/zaggino/z-schema.png)](https://ci.testling.com/zaggino/z-schema)

complete rewrite of [z-schema](https://github.com/zaggino/z-schema) in progress, not all tests and features have been migrated from version 2.x yet!

##Why rewrite?
- it runs in the browser now, run tests yourself [here](https://rawgit.com/zaggino/z-schema/master/test/SpecRunner.html)
- it is much faster than the 2.x, see below

#Topics

- [Usage](#usage)
- [Features](#features)
- [Options](#options)
- [Benchmarks](#benchmarks)

#Usage

Validator will try to perform sync validation when possible for speed, but supports async callbacks when they are necessary.

##NodeJS:

```javascript
var ZSchema = require("z-schema");
var options = ...
var validator = new ZSchema(options);
```

##Sync mode:

```javascript
var valid = validator.validate(json, schema);
var err = validator.getLastError();
...
```

##Async mode:

```javascript
validator.validate(json, schema, function (err, valid) {
    ...
});
```

##Browser:

```html
<script type="text/javascript" src="../dist/ZSchema-browser-min.js"></script>
<script type="text/javascript">
    var ZSchema = require("ZSchema");
	var validator = new ZSchema();
	var valid = validator.validate("string", { "type": "string" });
	console.log(valid);
</script>
```

#Features

- [Compile arrays of schemas and use references between them](#compilearrays)
- [Register a custom format](#registerformat)
- [Prefill default values to object using format](#prefillvalues)
- [Define a custom timeout for all async operations](#asynctimeout)
- [Disallow validation of empty arrays as arrays](#noemptyarrays)
- [Disallow validation of empty strings as strings](#noemptystrings)
- [Disallow schemas that don't have a type specified](#notypeless)
- [Disallow schemas that contain unrecognized keywords and are not validated by parent schemas](#noextrakeywords)
- [Assume additionalItems/additionalProperties are defined in schemas as false](#assumeadditional)
- [Force additionalItems/additionalProperties to be defined in schemas](#forceadditional)
- [Force items to be defined in array type schemas](#forceitems)
- [Force maxLength to be defined in string type schemas](#forcemaxlength)
- [Force properties or patternProperties to be defined in object type schemas](#forceproperties)
- [Ignore remote references to schemas that are not cached or resolvable](#ignoreunresolvablereferences)
- [Only allow strictly absolute URIs to be used in schemas](#stricturis)
- [Turn on z-schema strict mode](#strictmode)

##compileArrays

You can use validator to compile an array of schemas that have references between them and then validate against one of those schemas:

```javascript
var schemas = [
    {
        id: "personDetails",
        type: "object",
        properties: {
            firstName: { type: "string" },
            lastName: { type: "string" }
        },
        required: ["firstName", "lastName"]
    },
    {
        id: "addressDetails",
        type: "object",
        properties: {
            street: { type: "string" },
            city: { type: "string" }
        },
        required: ["street", "city"]
    },
    {
        id: "personWithAddress",
        allOf: [
            { $ref: "personDetails" },
            { $ref: "addressDetails" }
        ]
    }
];

var data = {
    firstName: "Martin",
    lastName: "Zagora",
    street: "George St",
    city: "Sydney"
};

var validator = new ZSchema();

// compile & validate schemas first, z-schema will automatically handle array
var allSchemasValid = validator.validateSchema(schemas);
// allSchemasValid === true

// now validate our data against the last schema
var valid = validator(data, schemas[2]);
// valid === true
```

##registerFormat

You can register any format of your own, sync validator function should always respond with boolean:

```javascript
ZSchema.registerFormat("xstring", function (str) {
    return str === "xxx";
});
```

Async format validators are also supported, they should accept two arguments, value and a callback to which they need to respond:

```javascript
ZSchema.registerFormat("xstring", function (str, callback) {
    setTimeout(function () {
        callback(str === "xxx");
    }, 1);
});
```

##prefillValues

Using format, you can pre-fill values of your choosing into the objects like this:

```
ZSchema.registerFormat("fillHello", function (obj) {
    obj.hello = "world";
    return true;
});

var data = {};

var schema = {
    "type": "object",
    "format": "fillHello"
};

validator.validate(data, schema);
// data.hello === "world"
```

#Options

##asyncTimeout

Defines a time limit, which should be used when waiting for async tasks like async format validators to perform their validation,
before the validation fails with an ```ASYNC_TIMEOUT``` error.

```javascript
var validator = new ZSchema({
    asyncTimeout: 2000
});
```

##noEmptyArrays

When true, validator will assume that minimum count of items in any ```array``` is 1, except when ```minItems: 0``` is explicitly defined.

```javascript
var validator = new ZSchema({
    noEmptyArrays: true
});
```

##noEmptyStrings

When true, validator will assume that minimum length of any string to pass type ```string``` validation is 1, except when ```minLength: 0``` is explicitly defined.

```javascript
var validator = new ZSchema({
    noEmptyStrings: true
});
```

##noTypeless

When true, validator will fail validation for schemas that don't specify a ```type``` of object that they expect.

```javascript
var validator = new ZSchema({
    noTypeless: true
});
```

##noExtraKeywords

When true, validator will fail for schemas that use keywords not defined in JSON Schema specification and doesn't provide a parent schema in ```$schema``` property to validate the schema.

```javascript
var validator = new ZSchema({
    noExtraKeywords: true
});
```

##assumeAdditional

When true, validator assumes that additionalItems/additionalProperties are defined as false so you don't have to manually fix all your schemas.

```javascript
var validator = new ZSchema({
    assumeAdditional: true
});
```

##forceAdditional

When true, validator doesn't validate schemas where additionalItems/additionalProperties should be defined to either true or false.

```javascript
var validator = new ZSchema({
    forceAdditional: true
});
```

##forceItems

When true, validator doesn't validate schemas where ```items``` are not defined for ```array``` type schemas.
This is to avoid passing anything through an array definition.

```javascript
var validator = new ZSchema({
    forceItems: true
});
```

##forceMaxLength

When true, validator doesn't validate schemas where ```maxLength``` is not defined for ```string``` type schemas.
This is to avoid passing extremly large strings which application doesn't expect to handle.

```javascript
var validator = new ZSchema({
    forceMaxLength: true
});
```

##forceProperties

When true, validator doesn't validate schemas where ```properties``` or ```patternProperties``` is not defined for ```object``` type schemas.
This is to avoid having objects with unexpected properties in application.

```javascript
var validator = new ZSchema({
    forceProperties: true
});
```

##ignoreUnresolvableReferences

When true, validator doesn't end with error when a remote reference is unreachable. **This setting is not recommended in production outside of testing.**

```javascript
var validator = new ZSchema({
    ignoreUnresolvableReferences: true
});
```

##strictUris

When true, all strings of format ```uri``` must be an absolute URIs and not only URI references. See more details in [this issue](https://github.com/zaggino/z-schema/issues/18).

```javascript
var validator = new ZSchema({
    strictUris: true
});
```

##strictMode

Strict mode of z-schema is currently equal to the following:

```javascript
var validator = new ZSchema({
    strictMode: true
});
```

```javascript
if (this.options.strictMode === true) {
    this.options.forceAdditional  = true;
    this.options.forceItems       = true;
    this.options.forceMaxLength   = true;
    this.options.forceProperties  = true;
    this.options.noExtraKeywords  = true;
    this.options.noTypeless       = true;
    this.options.noEmptyStrings   = true;
    this.options.noEmptyArrays    = true;
}
```

#Benchmarks

So how does it compare to version 2.x and others?

**NOTE: these tests are purely orientational, they don't consider extra features any of the validator may support and implement**

[rawgithub.com/zaggino/z-schema/master/benchmark/results.html](https://rawgithub.com/zaggino/z-schema/master/benchmark/results.html)

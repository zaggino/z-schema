#z-schema validator

[![npm version](https://badge.fury.io/js/z-schema.png)](http://badge.fury.io/js/z-schema)
[![build status](https://travis-ci.org/zaggino/z-schema-3.svg?branch=master)](https://travis-ci.org/zaggino/z-schema-3)

[![browser support](https://ci.testling.com/zaggino/z-schema-3.png)](https://ci.testling.com/zaggino/z-schema-3)

complete rewrite of [z-schema](https://github.com/zaggino/z-schema) in progress, not all tests and features have been migrated from version 2.x yet!

##Why rewrite?
- it runs in the browser now, run tests yourself [here](https://rawgit.com/zaggino/z-schema-3/master/test/SpecRunner.html)
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

#Features

- [Register a custom format](#registerFormat)
- [Define a custom timeout for all async operations](#asyncTimeout)
- [Disallow validation of empty strings as strings](#noEmptyStrings)
- [Disallow schemas that don't have a type specified](#noTypeless)
- [Assume additionalItems/additionalProperties are defined in schemas as false](#assumeAdditional)
- [Force additionalItems/additionalProperties to be defined in schemas](#forceAdditional)
- [Force items to be defined in array type schemas](#forceItems)

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

#Options

##asyncTimeout

Defines a time limit, which should be used when waiting for async tasks like async format validators to perform their validation,
before the validation fails with an ```ASYNC_TIMEOUT``` error.

```javascript
var validator = new ZSchema({
    asyncTimeout: 2000
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

When true, validator doesn't validate schemas where ```items``` are not defined for ```array``` type schemas. This is to avoid passing anything through an array definition.

```javascript
var validator = new ZSchema({
    forceItems: true
});
```

#Benchmarks

So how does it compare to version 2.x and others?

**NOTE: these tests are purely orientational, they don't consider extra features any of the validator may support and implement**

[rawgithub.com/zaggino/z-schema-3/master/benchmark/results.html](https://rawgithub.com/zaggino/z-schema-3/master/benchmark/results.html)

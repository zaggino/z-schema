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
- [Benchmarks](#benchmark)

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
var options = {
    asyncTimeout: 2000
};
var validator = new ZSchema(options);
```

#Benchmark

So how does it compare to version 2.x and others?

**NOTE: these tests are purely orientational, they don't consider extra features any of the validator may support and implement**

[rawgithub.com/zaggino/z-schema-3/master/benchmark/results.html](https://rawgithub.com/zaggino/z-schema-3/master/benchmark/results.html)

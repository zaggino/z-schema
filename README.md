#z-schema validator

[![npm version](https://badge.fury.io/js/z-schema.png)](http://badge.fury.io/js/z-schema)
[![build status](https://travis-ci.org/zaggino/z-schema-3.svg?branch=master)](https://travis-ci.org/zaggino/z-schema-3)

[![browser support](https://ci.testling.com/zaggino/z-schema-3.png)](https://ci.testling.com/zaggino/z-schema-3)

complete rewrite of [z-schema](https://github.com/zaggino/z-schema) in progress, not all tests and features have been migrated from version 2.x yet!

##Why rewrite?
- it runs in the browser now, run tests yourself [here](https://rawgit.com/zaggino/z-schema-3/master/test/SpecRunner.html)
- it is much faster than the 2.x, see below

#Topics

- [Features](#features)
- [Benchmarks](#benchmark)

#Features

- [Register a custom format](#registerFormat)

##registerFormat

You can register any format of your own, the validator function should always respond with boolean.

```javascript
var ZSchema = require("z-schema");
ZSchema.registerFormat("xstring", function (str) {
    return str === "xxx";
});
```

#Benchmark

So how does it compare to version 2.x and others?

**NOTE: these tests are purely orientational, they don't consider extra features any of the validator may support and implement**

[rawgithub.com/zaggino/z-schema-3/master/benchmark/results.html](https://rawgithub.com/zaggino/z-schema-3/master/benchmark/results.html)

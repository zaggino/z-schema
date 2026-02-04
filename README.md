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

See [FEATURES.md](FEATURES.md) for a full list of features.

## Options

See [OPTIONS.md](OPTIONS.md) for all available options and their descriptions.

## Contributing

These repository has several submodules and should be cloned as follows:

> git clone **--recursive** https://github.com/zaggino/z-schema.git

## Contributors

Big thanks to:

<!-- readme: contributors -start -->
<!-- readme: contributors -end -->

and to everyone submitting [issues](https://github.com/zaggino/z-schema/issues) on GitHub

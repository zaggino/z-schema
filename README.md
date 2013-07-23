z-schema validator
==================

JSON Schema validator for Node.js (draft4 version)

Coded according to:

[json-schema documentation](http://json-schema.org/documentation.html),
[json-schema-core](http://json-schema.org/latest/json-schema-core.html),
[json-schema-validation](http://json-schema.org/latest/json-schema-validation.html),
[json-schema-hypermedia](http://json-schema.org/latest/json-schema-hypermedia.html)

Passing all tests here (even optional, except zeroTerminatedFloats):

[json-schema/JSON-Schema-Test-Suite](https://github.com/json-schema/JSON-Schema-Test-Suite)

Will try to maintain this as much as possible, all bug reports welcome.

## Basic Usage

```javascript
var report = zSchema.validate(json, schema, function(report) {
    if (report.valid === true) ...
});
```

If ```report.valid === false```, then errors can be found in ```report.errors```.

The report object will look something like:

```json
{
    "valid": false,
    "errors": [
    
    ]
}
```
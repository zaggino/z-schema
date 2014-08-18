(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports = {
    description: "assumeAdditional - Assume additional properties/items in schemas are defined to false",
    options: {
        assumeAdditional: true
    },
    tests: [
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "string"
                    }
                }
            },
            data: {
                hello: "world"
            },
            description: "should pass validation when only defined properties are used",
            valid: true
        },
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "string"
                    }
                }
            },
            data: {
                hello: "world",
                good: "morning"
            },
            description: "should fail validation when other than defined properties are used",
            valid: false
        },
        {
            schema: {
                "type": "array",
                "items": [
                    { "type": "string" },
                    { "type": "string" },
                    { "type": "string" }
                ]
            },
            data: [
                "aaa",
                "bbb",
                "ccc"
            ],
            description: "should pass validation when only allowed items are used",
            valid: true
        },
        {
            schema: {
                "type": "array",
                "items": [
                    { "type": "string" },
                    { "type": "string" },
                    { "type": "string" }
                ]
            },
            data: [
                "aaa",
                "bbb",
                "ccc",
                null
            ],
            description: "should fail validation when other than allowed items are used",
            valid: false
        }
    ]
};

},{}],2:[function(require,module,exports){
"use strict";

module.exports = {
    description: "registerFormat - Custom formats support",
    setup: function (validator, Class) {
        Class.registerFormat("xstring", function (str) {
            return str === "xxx";
        });
        Class.registerFormat("emptystring", function (str) {
            return typeof str === "string" && str.length === 0 && str === "";
        });
    },
    schema: {
        "type": "string",
        "format": "xstring"
    },
    tests: [
        {
            description: "should pass custom format validation",
            data: "xxx",
            valid: true
        },
        {
            description: "should fail custom format validation",
            data: "xxxx",
            valid: false
        },
        {
            description: "should fail when using unknown format",
            data: "xxx",
            schema: {
                "type": "string",
                "format": "xstring2"
            },
            valid: false
        },
        {
            description: "should pass validating empty string",
            data: "",
            schema: {
                "type": "string",
                "format": "emptystring"
            },
            valid: true
        }
    ]
};

},{}],3:[function(require,module,exports){
"use strict";

module.exports = {
    description: "registerFormat - Custom formats async support",
    async: true,
    options: {
        asyncTimeout: 100
    },
    setup: function (validator, Class) {
        Class.registerFormat("xstring", function (str, callback) {
            setTimeout(function () {
                callback(str === "xxx");
            }, 1);
        });
        Class.registerFormat("shouldTimeout", function (str, callback) {
            return typeof callback === "function";
        });
    },
    schema: {
        "type": "string",
        "format": "xstring"
    },
    tests: [
        {
            description: "should pass custom format async validation",
            data: "xxx",
            valid: true
        },
        {
            description: "should fail custom format async validation",
            data: "xxxx",
            valid: false
        },
        {
            description: "should timeout if callback is not called in default limit",
            data: "xxx",
            schema: {
                "type": "string",
                "format": "shouldTimeout"
            },
            valid: false,
            after: function (err, valid) {
                expect(valid).toBe(false);
                expect(err.length).toBe(1);
                expect(err[0].code).toBe("ASYNC_TIMEOUT");
            }
        },
        {
            description: "should execute callback even if no async format is found",
            data: "xxx",
            schema: {
                "type": "string"
            },
            valid: true
        },
        {
            description: "should not call async validator if errors have been found before",
            data: "xxx",
            schema: {
                "type": "boolean",
                "format": "shouldTimeout"
            },
            valid: false,
            after: function (err, valid) {
                expect(valid).toBe(false);
                expect(err.length).toBe(1);
                expect(err[0].code).toBe("INVALID_TYPE");
            }
        }
    ]
};

},{}],4:[function(require,module,exports){
"use strict";

module.exports = {
    description: "forceAdditional - Force additional properties/items in schemas",
    options: {
        forceAdditional: true
    },
    validateSchemaOnly: true,
    tests: [
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "string"
                    }
                },
                "additionalProperties": false
            },
            description: "should pass schema validation when additionalProperties are defined on objects",
            valid: true
        },
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "string"
                    }
                }
            },
            description: "should fail schema validation when additionalProperties are not defined on objects",
            valid: false
        },
        {
            schema: {
                "type": "array",
                "items": [
                    {
                        "type": "string"
                    }
                ],
                "additionalItems": false
            },
            description: "should pass schema validation when additionalItems are defined on arrays",
            valid: true
        },
        {
            schema: {
                "type": "array",
                "items": [
                    {
                        "type": "string"
                    }
                ]
            },
            description: "should fail schema validation when additionalItems are not defined on arrays",
            valid: false
        },
        {
            schema: {
                "type": "array",
                "items": {
                    "type": "string"
                }
            },
            description: "should pass schema validation without additionalItems because they doesn't matter when items is a schema",
            valid: true
        }
    ]
};

},{}],5:[function(require,module,exports){
"use strict";

module.exports = {
    description: "forceItems - Force items to be defined on arrays",
    options: {
        forceItems: true
    },
    validateSchemaOnly: true,
    tests: [
        {
            schema: {
                "type": "array",
                "items": {}
            },
            description: "should pass schema validation because items are defined",
            valid: true
        },
        {
            schema: {
                "type": "array"
            },
            description: "should fail schema validation because items are not defined",
            valid: false
        }
    ]
};

},{}],6:[function(require,module,exports){
"use strict";

module.exports = {
    description: "forceMaxLength - Force maxLength to be defined on strings",
    options: {
        forceMaxLength: true
    },
    validateSchemaOnly: true,
    tests: [
        {
            schema: {
                "type": "string",
                "maxLength": 20
            },
            description: "should pass schema validation because maxLength is defined",
            valid: true
        },
        {
            schema: {
                "type": "string"
            },
            description: "should fail schema validation because maxLength is not defined",
            valid: false
        }
    ]
};

},{}],7:[function(require,module,exports){
"use strict";

module.exports = {
    description: "forceProperties - Force properties to be defined on objects",
    options: {
        forceProperties: true
    },
    validateSchemaOnly: true,
    tests: [
        {
            schema: {
                "type": "object",
                "properties": {
                    "test": {}
                }
            },
            description: "should pass schema validation because properties are defined",
            valid: true
        },
        {
            schema: {
                "type": "object",
                "patternProperties": {
                    "te(s|t)": {}
                }
            },
            description: "should pass schema validation because patternProperties are defined",
            valid: true
        },
        {
            schema: {
                "type": "object"
            },
            description: "should fail schema validation because properties are not defined",
            valid: false
        },
        {
            schema: {
                "type": "object",
                "properties": {}
            },
            description: "should fail schema validation because properties are present but doesn't define any properties",
            valid: false
        },
        {
            schema: {
                "type": "object",
                "patternProperties": {}
            },
            description: "should fail schema validation because patternProperties are present but doesn't define any properties",
            valid: false
        }
    ]
};

},{}],8:[function(require,module,exports){
"use strict";

module.exports = {
    description: "ignoreUnresolvableReferences - Ignore remote references in schemas",
    options: {
        ignoreUnresolvableReferences: true
    },
    validateSchemaOnly: true,
    tests: [
        {
            schema: {
                "$schema": "http://doesnt-exists.org/draft-04/schema",
            },
            description: "should pass schema validation because link is to http schema",
            valid: true
        },
        {
            schema: {
                "definitions": {
                    "a": {"type": "integer"},
                    "b": {"$ref": "#/definitions/a"},
                    "c": {"$ref": "#/definitions/b"}
                },
                "$ref": "#/definitions/c"
            },
            description: "should pass schema validation because definitions are resolvable",
            valid: true
        },
        {
            schema: {
                "definitions": {
                    "a": {"type": "integer"},
                    "b": {"$ref": "#/definitions/aaa"},
                    "c": {"$ref": "#/definitions/b"}
                },
                "$ref": "#/definitions/c"
            },
            description: "should fail schema validation because definitions are not resolvable",
            valid: false
        }
    ]
};

},{}],9:[function(require,module,exports){
"use strict";

module.exports = {
    description: "noEmptyStrings - Don't allow empty strings to validate as strings",
    options: {
        noEmptyStrings: true
    },
    schema: {
        "type": "string"
    },
    tests: [
        {
            description: "should pass validation when using a proper string",
            data: "hello",
            valid: true
        },
        {
            description: "should fail validation when using an empty string",
            data: "",
            valid: false
        }
    ]
};

},{}],10:[function(require,module,exports){
"use strict";

module.exports = {
    description: "noExtraKeywords - Forbid unrecognized keywords to be defined in schemas",
    options: {
        noExtraKeywords: true
    },
    validateSchemaOnly: true,
    tests: [
        {
            schema: {},
            description: "should pass schema validation",
            valid: true
        },
        {
            schema: {
                "random_keyword": "string"
            },
            description: "should fail schema validation, because 'random_keyword' is not known keyword",
            valid: false
        },
        {
            schema: {
                "$schema": "http://json-schema.org/draft-04/schema#",
                "random_keyword": "string"
            },
            description: "should pass schema validation, because schema is validated by $schema, even though it has 'random_keyword'",
            valid: true
        },
        {
            schema: {
                "$schema": "http://json-schema.org/draft-04/schema#",
                "title": 1
            },
            description: "should fail schema validation, because schema is validated by $schema and number is not valid for title",
            valid: false,
            after: function (err, valid) {
                expect(valid).toBe(false);
                expect(err[0].code).toBe("PARENT_SCHEMA_VALIDATION_FAILED");
            }
        }
    ]
};

},{}],11:[function(require,module,exports){
"use strict";

module.exports = {
    description: "noTypeless - Don't allow schemas without type specified",
    validateSchemaOnly: true,
    options: {
        noTypeless: true
    },
    tests: [
        {
            description: "should pass validation when using a type in schema",
            schema: {
                "type": "string"
            },
            valid: true
        },
        {
            description: "should fail validation when not using a type in schema",
            schema: {},
            valid: false
        }
    ]
};

},{}],12:[function(require,module,exports){
"use strict";

module.exports = {
    description: "strictUris - validates URIs as absolute and disallow URI references",
    options: {
        strictUris: true
    },
    tests: [
        {
            schema: {
                "type": "string",
                "format": "uri"
            },
            data: "http://json-schema.org/draft-04/schema",
            description: "should pass validation because it is an absolute URI",
            valid: true
        },
        {
            schema: {
                "type": "string",
                "format": "uri"
            },
            data: "schemaA",
            description: "should fail validation because it is only a valid URI reference",
            valid: false
        }
    ]
};

},{}],13:[function(require,module,exports){
module.exports={
    "id": "http://json-schema.org/draft-04/schema#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "description": "Core schema meta-schema",
    "definitions": {
        "schemaArray": {
            "type": "array",
            "minItems": 1,
            "items": { "$ref": "#" }
        },
        "positiveInteger": {
            "type": "integer",
            "minimum": 0
        },
        "positiveIntegerDefault0": {
            "allOf": [ { "$ref": "#/definitions/positiveInteger" }, { "default": 0 } ]
        },
        "simpleTypes": {
            "enum": [ "array", "boolean", "integer", "null", "number", "object", "string" ]
        },
        "stringArray": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 1,
            "uniqueItems": true
        }
    },
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
            "format": "uri"
        },
        "$schema": {
            "type": "string",
            "format": "uri"
        },
        "title": {
            "type": "string"
        },
        "description": {
            "type": "string"
        },
        "default": {},
        "multipleOf": {
            "type": "number",
            "minimum": 0,
            "exclusiveMinimum": true
        },
        "maximum": {
            "type": "number"
        },
        "exclusiveMaximum": {
            "type": "boolean",
            "default": false
        },
        "minimum": {
            "type": "number"
        },
        "exclusiveMinimum": {
            "type": "boolean",
            "default": false
        },
        "maxLength": { "$ref": "#/definitions/positiveInteger" },
        "minLength": { "$ref": "#/definitions/positiveIntegerDefault0" },
        "pattern": {
            "type": "string",
            "format": "regex"
        },
        "additionalItems": {
            "anyOf": [
                { "type": "boolean" },
                { "$ref": "#" }
            ],
            "default": {}
        },
        "items": {
            "anyOf": [
                { "$ref": "#" },
                { "$ref": "#/definitions/schemaArray" }
            ],
            "default": {}
        },
        "maxItems": { "$ref": "#/definitions/positiveInteger" },
        "minItems": { "$ref": "#/definitions/positiveIntegerDefault0" },
        "uniqueItems": {
            "type": "boolean",
            "default": false
        },
        "maxProperties": { "$ref": "#/definitions/positiveInteger" },
        "minProperties": { "$ref": "#/definitions/positiveIntegerDefault0" },
        "required": { "$ref": "#/definitions/stringArray" },
        "additionalProperties": {
            "anyOf": [
                { "type": "boolean" },
                { "$ref": "#" }
            ],
            "default": {}
        },
        "definitions": {
            "type": "object",
            "additionalProperties": { "$ref": "#" },
            "default": {}
        },
        "properties": {
            "type": "object",
            "additionalProperties": { "$ref": "#" },
            "default": {}
        },
        "patternProperties": {
            "type": "object",
            "additionalProperties": { "$ref": "#" },
            "default": {}
        },
        "dependencies": {
            "type": "object",
            "additionalProperties": {
                "anyOf": [
                    { "$ref": "#" },
                    { "$ref": "#/definitions/stringArray" }
                ]
            }
        },
        "enum": {
            "type": "array",
            "minItems": 1,
            "uniqueItems": true
        },
        "type": {
            "anyOf": [
                { "$ref": "#/definitions/simpleTypes" },
                {
                    "type": "array",
                    "items": { "$ref": "#/definitions/simpleTypes" },
                    "minItems": 1,
                    "uniqueItems": true
                }
            ]
        },
        "allOf": { "$ref": "#/definitions/schemaArray" },
        "anyOf": { "$ref": "#/definitions/schemaArray" },
        "oneOf": { "$ref": "#/definitions/schemaArray" },
        "not": { "$ref": "#" }
    },
    "dependencies": {
        "exclusiveMaximum": [ "maximum" ],
        "exclusiveMinimum": [ "minimum" ]
    },
    "default": {}
}

},{}],14:[function(require,module,exports){
module.exports={
    "type": "integer"
}
},{}],15:[function(require,module,exports){
module.exports=require(14)
},{}],16:[function(require,module,exports){
module.exports={
    "integer": {
        "type": "integer"
    }, 
    "refToInteger": {
        "$ref": "#/integer"
    }
}
},{}],17:[function(require,module,exports){
module.exports=[
    {
        "description": "additionalItems as schema",
        "schema": {
            "items": [{}],
            "additionalItems": {"type": "integer"}
        },
        "tests": [
            {
                "description": "additional items match schema",
                "data": [ null, 2, 3, 4 ],
                "valid": true
            },
            {
                "description": "additional items do not match schema",
                "data": [ null, 2, 3, "foo" ],
                "valid": false
            }
        ]
    },
    {
        "description": "items is schema, no additionalItems",
        "schema": {
            "items": {},
            "additionalItems": false
        },
        "tests": [
            {
                "description": "all items match schema",
                "data": [ 1, 2, 3, 4, 5 ],
                "valid": true
            }
        ]
    },
    {
        "description": "array of items with no additionalItems",
        "schema": {
            "items": [{}, {}, {}],
            "additionalItems": false
        },
        "tests": [
            {
                "description": "no additional items present",
                "data": [ 1, 2, 3 ],
                "valid": true
            },
            {
                "description": "additional items are not permitted",
                "data": [ 1, 2, 3, 4 ],
                "valid": false
            }
        ]
    },
    {
        "description": "additionalItems as false without items",
        "schema": {"additionalItems": false},
        "tests": [
            {
                "description":
                    "items defaults to empty schema so everything is valid",
                "data": [ 1, 2, 3, 4, 5 ],
                "valid": true
            },
            {
                "description": "ignores non-arrays",
                "data": {"foo" : "bar"},
                "valid": true
            }
        ]
    },
    {
        "description": "additionalItems are allowed by default",
        "schema": {"items": [{"type": "integer"}]},
        "tests": [
            {
                "description": "only the first item is validated",
                "data": [1, "foo", false],
                "valid": true
            }
        ]
    }
]

},{}],18:[function(require,module,exports){
module.exports=[
    {
        "description":
            "additionalProperties being false does not allow other properties",
        "schema": {
            "properties": {"foo": {}, "bar": {}},
            "patternProperties": { "^v": {} },
            "additionalProperties": false
        },
        "tests": [
            {
                "description": "no additional properties is valid",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "an additional property is invalid",
                "data": {"foo" : 1, "bar" : 2, "quux" : "boom"},
                "valid": false
            },
            {
                "description": "ignores non-objects",
                "data": [1, 2, 3],
                "valid": true
            },
            {
                "description": "patternProperties are not additional properties",
                "data": {"foo":1, "vroom": 2},
                "valid": true
            }
        ]
    },
    {
        "description":
            "additionalProperties allows a schema which should validate",
        "schema": {
            "properties": {"foo": {}, "bar": {}},
            "additionalProperties": {"type": "boolean"}
        },
        "tests": [
            {
                "description": "no additional properties is valid",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "an additional valid property is valid",
                "data": {"foo" : 1, "bar" : 2, "quux" : true},
                "valid": true
            },
            {
                "description": "an additional invalid property is invalid",
                "data": {"foo" : 1, "bar" : 2, "quux" : 12},
                "valid": false
            }
        ]
    },
    {
        "description": "additionalProperties are allowed by default",
        "schema": {"properties": {"foo": {}, "bar": {}}},
        "tests": [
            {
                "description": "additional properties are allowed",
                "data": {"foo": 1, "bar": 2, "quux": true},
                "valid": true
            }
        ]
    }
]

},{}],19:[function(require,module,exports){
module.exports=[
    {
        "description": "allOf",
        "schema": {
            "allOf": [
                {
                    "properties": {
                        "bar": {"type": "integer"}
                    },
                    "required": ["bar"]
                },
                {
                    "properties": {
                        "foo": {"type": "string"}
                    },
                    "required": ["foo"]
                }
            ]
        },
        "tests": [
            {
                "description": "allOf",
                "data": {"foo": "baz", "bar": 2},
                "valid": true
            },
            {
                "description": "mismatch second",
                "data": {"foo": "baz"},
                "valid": false
            },
            {
                "description": "mismatch first",
                "data": {"bar": 2},
                "valid": false
            },
            {
                "description": "wrong type",
                "data": {"foo": "baz", "bar": "quux"},
                "valid": false
            }
        ]
    },
    {
        "description": "allOf with base schema",
        "schema": {
            "properties": {"bar": {"type": "integer"}},
            "required": ["bar"],
            "allOf" : [
                {
                    "properties": {
                        "foo": {"type": "string"}
                    },
                    "required": ["foo"]
                },
                {
                    "properties": {
                        "baz": {"type": "null"}
                    },
                    "required": ["baz"]
                }
            ]
        },
        "tests": [
            {
                "description": "valid",
                "data": {"foo": "quux", "bar": 2, "baz": null},
                "valid": true
            },
            {
                "description": "mismatch base schema",
                "data": {"foo": "quux", "baz": null},
                "valid": false
            },
            {
                "description": "mismatch first allOf",
                "data": {"bar": 2, "baz": null},
                "valid": false
            },
            {
                "description": "mismatch second allOf",
                "data": {"foo": "quux", "bar": 2},
                "valid": false
            },
            {
                "description": "mismatch both",
                "data": {"bar": 2},
                "valid": false
            }
        ]
    },
    {
        "description": "allOf simple types",
        "schema": {
            "allOf": [
                {"maximum": 30},
                {"minimum": 20}
            ]
        },
        "tests": [
            {
                "description": "valid",
                "data": 25,
                "valid": true
            },
            {
                "description": "mismatch one",
                "data": 35,
                "valid": false
            }
        ]
    }
]

},{}],20:[function(require,module,exports){
module.exports=[
    {
        "description": "anyOf",
        "schema": {
            "anyOf": [
                {
                    "type": "integer"
                },
                {
                    "minimum": 2
                }
            ]
        },
        "tests": [
            {
                "description": "first anyOf valid",
                "data": 1,
                "valid": true
            },
            {
                "description": "second anyOf valid",
                "data": 2.5,
                "valid": true
            },
            {
                "description": "both anyOf valid",
                "data": 3,
                "valid": true
            },
            {
                "description": "neither anyOf valid",
                "data": 1.5,
                "valid": false
            }
        ]
    },
    {
        "description": "anyOf with base schema",
        "schema": {
            "type": "string",
            "anyOf" : [
                {
                    "maxLength": 2
                },
                {
                    "minLength": 4
                }
            ]
        },
        "tests": [
            {
                "description": "mismatch base schema",
                "data": 3,
                "valid": false
            },
            {
                "description": "one anyOf valid",
                "data": "foobar",
                "valid": true
            },
            {
                "description": "both anyOf invalid",
                "data": "foo",
                "valid": false
            }
        ]
    }
]

},{}],21:[function(require,module,exports){
module.exports=[
    {
        "description": "valid definition",
        "schema": {"$ref": "http://json-schema.org/draft-04/schema#"},
        "tests": [
            {
                "description": "valid definition schema",
                "data": {
                    "definitions": {
                        "foo": {"type": "integer"}
                    }
                },
                "valid": true
            }
        ]
    },
    {
        "description": "invalid definition",
        "schema": {"$ref": "http://json-schema.org/draft-04/schema#"},
        "tests": [
            {
                "description": "invalid definition schema",
                "data": {
                    "definitions": {
                        "foo": {"type": 1}
                    }
                },
                "valid": false
            }
        ]
    }
]

},{}],22:[function(require,module,exports){
module.exports=[
    {
        "description": "dependencies",
        "schema": {
            "dependencies": {"bar": ["foo"]}
        },
        "tests": [
            {
                "description": "neither",
                "data": {},
                "valid": true
            },
            {
                "description": "nondependant",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "with dependency",
                "data": {"foo": 1, "bar": 2},
                "valid": true
            },
            {
                "description": "missing dependency",
                "data": {"bar": 2},
                "valid": false
            },
            {
                "description": "ignores non-objects",
                "data": "foo",
                "valid": true
            }
        ]
    },
    {
        "description": "multiple dependencies",
        "schema": {
            "dependencies": {"quux": ["foo", "bar"]}
        },
        "tests": [
            {
                "description": "neither",
                "data": {},
                "valid": true
            },
            {
                "description": "nondependants",
                "data": {"foo": 1, "bar": 2},
                "valid": true
            },
            {
                "description": "with dependencies",
                "data": {"foo": 1, "bar": 2, "quux": 3},
                "valid": true
            },
            {
                "description": "missing dependency",
                "data": {"foo": 1, "quux": 2},
                "valid": false
            },
            {
                "description": "missing other dependency",
                "data": {"bar": 1, "quux": 2},
                "valid": false
            },
            {
                "description": "missing both dependencies",
                "data": {"quux": 1},
                "valid": false
            }
        ]
    },
    {
        "description": "multiple dependencies subschema",
        "schema": {
            "dependencies": {
                "bar": {
                    "properties": {
                        "foo": {"type": "integer"},
                        "bar": {"type": "integer"}
                    }
                }
            }
        },
        "tests": [
            {
                "description": "valid",
                "data": {"foo": 1, "bar": 2},
                "valid": true
            },
            {
                "description": "no dependency",
                "data": {"foo": "quux"},
                "valid": true
            },
            {
                "description": "wrong type",
                "data": {"foo": "quux", "bar": 2},
                "valid": false
            },
            {
                "description": "wrong type other",
                "data": {"foo": 2, "bar": "quux"},
                "valid": false
            },
            {
                "description": "wrong type both",
                "data": {"foo": "quux", "bar": "quux"},
                "valid": false
            }
        ]
    }
]

},{}],23:[function(require,module,exports){
module.exports=[
    {
        "description": "simple enum validation",
        "schema": {"enum": [1, 2, 3]},
        "tests": [
            {
                "description": "one of the enum is valid",
                "data": 1,
                "valid": true
            },
            {
                "description": "something else is invalid",
                "data": 4,
                "valid": false
            }
        ]
    },
    {
        "description": "heterogeneous enum validation",
        "schema": {"enum": [6, "foo", [], true, {"foo": 12}]},
        "tests": [
            {
                "description": "one of the enum is valid",
                "data": [],
                "valid": true
            },
            {
                "description": "something else is invalid",
                "data": null,
                "valid": false
            },
            {
                "description": "objects are deep compared",
                "data": {"foo": false},
                "valid": false
            }
        ]
    },
    {
        "description": "enums in properties",
        "schema": {
           "type":"object",
		     "properties": {
		        "foo": {"enum":["foo"]},
		        "bar": {"enum":["bar"]}
		     },
		     "required": ["bar"]
		  },
        "tests": [
            {
                "description": "both properties are valid",
                "data": {"foo":"foo", "bar":"bar"},
                "valid": true
            },
            {
                "description": "missing optional property is valid",
                "data": {"bar":"bar"},
                "valid": true
            },
            {
                "description": "missing required property is invalid",
                "data": {"foo":"foo"},
                "valid": false
            },
            {
                "description": "missing all properties is invalid",
                "data": {},
                "valid": false
            }
        ]
    }
]

},{}],24:[function(require,module,exports){
module.exports=[
    {
        "description": "a schema given for items",
        "schema": {
            "items": {"type": "integer"}
        },
        "tests": [
            {
                "description": "valid items",
                "data": [ 1, 2, 3 ],
                "valid": true
            },
            {
                "description": "wrong type of items",
                "data": [1, "x"],
                "valid": false
            },
            {
                "description": "ignores non-arrays",
                "data": {"foo" : "bar"},
                "valid": true
            }
        ]
    },
    {
        "description": "an array of schemas for items",
        "schema": {
            "items": [
                {"type": "integer"},
                {"type": "string"}
            ]
        },
        "tests": [
            {
                "description": "correct types",
                "data": [ 1, "foo" ],
                "valid": true
            },
            {
                "description": "wrong types",
                "data": [ "foo", 1 ],
                "valid": false
            }
        ]
    }
]

},{}],25:[function(require,module,exports){
module.exports=[
    {
        "description": "maxItems validation",
        "schema": {"maxItems": 2},
        "tests": [
            {
                "description": "shorter is valid",
                "data": [1],
                "valid": true
            },
            {
                "description": "exact length is valid",
                "data": [1, 2],
                "valid": true
            },
            {
                "description": "too long is invalid",
                "data": [1, 2, 3],
                "valid": false
            },
            {
                "description": "ignores non-arrays",
                "data": "foobar",
                "valid": true
            }
        ]
    }
]

},{}],26:[function(require,module,exports){
module.exports=[
    {
        "description": "maxLength validation",
        "schema": {"maxLength": 2},
        "tests": [
            {
                "description": "shorter is valid",
                "data": "f",
                "valid": true
            },
            {
                "description": "exact length is valid",
                "data": "fo",
                "valid": true
            },
            {
                "description": "too long is invalid",
                "data": "foo",
                "valid": false
            },
            {
                "description": "ignores non-strings",
                "data": 100,
                "valid": true
            },
            {
                "description": "two supplementary Unicode code points is long enough",
                "data": "\uD83D\uDCA9\uD83D\uDCA9",
                "valid": true
            }
        ]
    }
]

},{}],27:[function(require,module,exports){
module.exports=[
    {
        "description": "maxProperties validation",
        "schema": {"maxProperties": 2},
        "tests": [
            {
                "description": "shorter is valid",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "exact length is valid",
                "data": {"foo": 1, "bar": 2},
                "valid": true
            },
            {
                "description": "too long is invalid",
                "data": {"foo": 1, "bar": 2, "baz": 3},
                "valid": false
            },
            {
                "description": "ignores non-objects",
                "data": "foobar",
                "valid": true
            }
        ]
    }
]

},{}],28:[function(require,module,exports){
module.exports=[
    {
        "description": "maximum validation",
        "schema": {"maximum": 3.0},
        "tests": [
            {
                "description": "below the maximum is valid",
                "data": 2.6,
                "valid": true
            },
            {
                "description": "above the maximum is invalid",
                "data": 3.5,
                "valid": false
            },
            {
                "description": "ignores non-numbers",
                "data": "x",
                "valid": true
            }
        ]
    },
    {
        "description": "exclusiveMaximum validation",
        "schema": {
            "maximum": 3.0,
            "exclusiveMaximum": true
        },
        "tests": [
            {
                "description": "below the maximum is still valid",
                "data": 2.2,
                "valid": true
            },
            {
                "description": "boundary point is invalid",
                "data": 3.0,
                "valid": false
            }
        ]
    }
]

},{}],29:[function(require,module,exports){
module.exports=[
    {
        "description": "minItems validation",
        "schema": {"minItems": 1},
        "tests": [
            {
                "description": "longer is valid",
                "data": [1, 2],
                "valid": true
            },
            {
                "description": "exact length is valid",
                "data": [1],
                "valid": true
            },
            {
                "description": "too short is invalid",
                "data": [],
                "valid": false
            },
            {
                "description": "ignores non-arrays",
                "data": "",
                "valid": true
            }
        ]
    }
]

},{}],30:[function(require,module,exports){
module.exports=[
    {
        "description": "minLength validation",
        "schema": {"minLength": 2},
        "tests": [
            {
                "description": "longer is valid",
                "data": "foo",
                "valid": true
            },
            {
                "description": "exact length is valid",
                "data": "fo",
                "valid": true
            },
            {
                "description": "too short is invalid",
                "data": "f",
                "valid": false
            },
            {
                "description": "ignores non-strings",
                "data": 1,
                "valid": true
            },
            {
                "description": "one supplementary Unicode code point is not long enough",
                "data": "\uD83D\uDCA9",
                "valid": false
            }
        ]
    }
]

},{}],31:[function(require,module,exports){
module.exports=[
    {
        "description": "minProperties validation",
        "schema": {"minProperties": 1},
        "tests": [
            {
                "description": "longer is valid",
                "data": {"foo": 1, "bar": 2},
                "valid": true
            },
            {
                "description": "exact length is valid",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "too short is invalid",
                "data": {},
                "valid": false
            },
            {
                "description": "ignores non-objects",
                "data": "",
                "valid": true
            }
        ]
    }
]

},{}],32:[function(require,module,exports){
module.exports=[
    {
        "description": "minimum validation",
        "schema": {"minimum": 1.1},
        "tests": [
            {
                "description": "above the minimum is valid",
                "data": 2.6,
                "valid": true
            },
            {
                "description": "below the minimum is invalid",
                "data": 0.6,
                "valid": false
            },
            {
                "description": "ignores non-numbers",
                "data": "x",
                "valid": true
            }
        ]
    },
    {
        "description": "exclusiveMinimum validation",
        "schema": {
            "minimum": 1.1,
            "exclusiveMinimum": true
        },
        "tests": [
            {
                "description": "above the minimum is still valid",
                "data": 1.2,
                "valid": true
            },
            {
                "description": "boundary point is invalid",
                "data": 1.1,
                "valid": false
            }
        ]
    }
]

},{}],33:[function(require,module,exports){
module.exports=[
    {
        "description": "by int",
        "schema": {"multipleOf": 2},
        "tests": [
            {
                "description": "int by int",
                "data": 10,
                "valid": true
            },
            {
                "description": "int by int fail",
                "data": 7,
                "valid": false
            },
            {
                "description": "ignores non-numbers",
                "data": "foo",
                "valid": true
            }
        ]
    },
    {
        "description": "by number",
        "schema": {"multipleOf": 1.5},
        "tests": [
            {
                "description": "zero is multiple of anything",
                "data": 0,
                "valid": true
            },
            {
                "description": "4.5 is multiple of 1.5",
                "data": 4.5,
                "valid": true
            },
            {
                "description": "35 is not multiple of 1.5",
                "data": 35,
                "valid": false
            }
        ]
    },
    {
        "description": "by small number",
        "schema": {"multipleOf": 0.0001},
        "tests": [
            {
                "description": "0.0075 is multiple of 0.0001",
                "data": 0.0075,
                "valid": true
            },
            {
                "description": "0.00751 is not multiple of 0.0001",
                "data": 0.00751,
                "valid": false
            }
        ]
    }
]

},{}],34:[function(require,module,exports){
module.exports=[
    {
        "description": "not",
        "schema": {
            "not": {"type": "integer"}
        },
        "tests": [
            {
                "description": "allowed",
                "data": "foo",
                "valid": true
            },
            {
                "description": "disallowed",
                "data": 1,
                "valid": false
            }
        ]
    },
    {
        "description": "not multiple types",
        "schema": {
            "not": {"type": ["integer", "boolean"]}
        },
        "tests": [
            {
                "description": "valid",
                "data": "foo",
                "valid": true
            },
            {
                "description": "mismatch",
                "data": 1,
                "valid": false
            },
            {
                "description": "other mismatch",
                "data": true,
                "valid": false
            }
        ]
    },
    {
        "description": "not more complex schema",
        "schema": {
            "not": {
                "type": "object",
                "properties": {
                    "foo": {
                        "type": "string"
                    }
                }
             }
        },
        "tests": [
            {
                "description": "match",
                "data": 1,
                "valid": true
            },
            {
                "description": "other match",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "mismatch",
                "data": {"foo": "bar"},
                "valid": false
            }
        ]
    },
    {
        "description": "forbidden property",
        "schema": {
            "properties": {
                "foo": { 
                    "not": {}
                }
            }
        },
        "tests": [
            {
                "description": "property present",
                "data": {"foo": 1, "bar": 2},
                "valid": false
            },
            {
                "description": "property absent",
                "data": {"bar": 1, "baz": 2},
                "valid": true
            }
        ]
    }

]

},{}],35:[function(require,module,exports){
module.exports=[
    {
        "description": "oneOf",
        "schema": {
            "oneOf": [
                {
                    "type": "integer"
                },
                {
                    "minimum": 2
                }
            ]
        },
        "tests": [
            {
                "description": "first oneOf valid",
                "data": 1,
                "valid": true
            },
            {
                "description": "second oneOf valid",
                "data": 2.5,
                "valid": true
            },
            {
                "description": "both oneOf valid",
                "data": 3,
                "valid": false
            },
            {
                "description": "neither oneOf valid",
                "data": 1.5,
                "valid": false
            }
        ]
    },
    {
        "description": "oneOf with base schema",
        "schema": {
            "type": "string",
            "oneOf" : [
                {
                    "minLength": 2
                },
                {
                    "maxLength": 4
                }
            ]
        },
        "tests": [
            {
                "description": "mismatch base schema",
                "data": 3,
                "valid": false
            },
            {
                "description": "one oneOf valid",
                "data": "foobar",
                "valid": true
            },
            {
                "description": "both oneOf valid",
                "data": "foo",
                "valid": false
            }
        ]
    }
]

},{}],36:[function(require,module,exports){
module.exports=[
    {
        "description": "integer",
        "schema": {"type": "integer"},
        "tests": [
            {
                "description": "a bignum is an integer",
                "data": 12345678910111213141516171819202122232425262728293031,
                "valid": true
            }
        ]
    },
    {
        "description": "number",
        "schema": {"type": "number"},
        "tests": [
            {
                "description": "a bignum is a number",
                "data": 98249283749234923498293171823948729348710298301928331,
                "valid": true
            }
        ]
    },
    {
        "description": "string",
        "schema": {"type": "string"},
        "tests": [
            {
                "description": "a bignum is not a string",
                "data": 98249283749234923498293171823948729348710298301928331,
                "valid": false
            }
        ]
    },
    {
        "description": "integer comparison",
        "schema": {"maximum": 18446744073709551615},
        "tests": [
            {
                "description": "comparison works for high numbers",
                "data": 18446744073709551600,
                "valid": true
            }
        ]
    },
    {
        "description": "float comparison with high precision",
        "schema": {
            "maximum": 972783798187987123879878123.18878137,
            "exclusiveMaximum": true
        },
        "tests": [
            {
                "description": "comparison works for high numbers",
                "data": 972783798187987123879878123.188781371,
                "valid": false
            }
        ]
    }
]

},{}],37:[function(require,module,exports){
module.exports=[
    {
        "description": "validation of date-time strings",
        "schema": {"format": "date-time"},
        "tests": [
            {
                "description": "a valid date-time string",
                "data": "1963-06-19T08:30:06.283185Z",
                "valid": true
            },
            {
                "description": "an invalid date-time string",
                "data": "06/19/1963 08:30:06 PST",
                "valid": false
            },
            {
                "description": "only RFC3339 not all of ISO 8601 are valid",
                "data": "2013-350T01:01:01",
                "valid": false
            }
        ]
    },
    {
        "description": "validation of URIs",
        "schema": {"format": "uri"},
        "tests": [
            {
                "description": "a valid URI",
                "data": "http://foo.bar/?baz=qux#quux",
                "valid": true
            },
            {
                "description": "an invalid URI",
                "data": "\\\\WINDOWS\\fileshare",
                "valid": false
            },
            {
                "description": "an invalid URI though valid URI reference",
                "data": "abc",
                "valid": false
            }
        ]
    },
    {
        "description": "validation of e-mail addresses",
        "schema": {"format": "email"},
        "tests": [
            {
                "description": "a valid e-mail address",
                "data": "joe.bloggs@example.com",
                "valid": true
            },
            {
                "description": "an invalid e-mail address",
                "data": "2962",
                "valid": false
            }
        ]
    },
    {
        "description": "validation of IP addresses",
        "schema": {"format": "ipv4"},
        "tests": [
            {
                "description": "a valid IP address",
                "data": "192.168.0.1",
                "valid": true
            },
            {
                "description": "an IP address with too many components",
                "data": "127.0.0.0.1",
                "valid": false
            },
            {
                "description": "an IP address with out-of-range values",
                "data": "256.256.256.256",
                "valid": false
            },
            {
                "description": "an IP address without 4 components",
                "data": "127.0",
                "valid": false
            },
            {
                "description": "an IP address as an integer",
                "data": "0x7f000001",
                "valid": false
            }
        ]
    },
    {
        "description": "validation of IPv6 addresses",
        "schema": {"format": "ipv6"},
        "tests": [
            {
                "description": "a valid IPv6 address",
                "data": "::1",
                "valid": true
            },
            {
                "description": "an IPv6 address with out-of-range values",
                "data": "12345::",
                "valid": false
            },
            {
                "description": "an IPv6 address with too many components",
                "data": "1:1:1:1:1:1:1:1:1:1:1:1:1:1:1:1",
                "valid": false
            },
            {
                "description": "an IPv6 address containing illegal characters",
                "data": "::laptop",
                "valid": false
            }
        ]
    },
    {
        "description": "validation of host names",
        "schema": {"format": "hostname"},
        "tests": [
            {
                "description": "a valid host name",
                "data": "www.example.com",
                "valid": true
            },
            {
                "description": "a host name starting with an illegal character",
                "data": "-a-host-name-that-starts-with--",
                "valid": false
            },
            {
                "description": "a host name containing illegal characters",
                "data": "not_a_valid_host_name",
                "valid": false
            },
            {
                "description": "a host name with a component too long",
                "data": "a-vvvvvvvvvvvvvvvveeeeeeeeeeeeeeeerrrrrrrrrrrrrrrryyyyyyyyyyyyyyyy-long-host-name-component",
                "valid": false
            }
        ]
    }
]

},{}],38:[function(require,module,exports){
module.exports=[
    {
        "description": "pattern validation",
        "schema": {"pattern": "^a*$"},
        "tests": [
            {
                "description": "a matching pattern is valid",
                "data": "aaa",
                "valid": true
            },
            {
                "description": "a non-matching pattern is invalid",
                "data": "abc",
                "valid": false
            },
            {
                "description": "ignores non-strings",
                "data": true,
                "valid": true
            }
        ]
    }
]

},{}],39:[function(require,module,exports){
module.exports=[
    {
        "description":
            "patternProperties validates properties matching a regex",
        "schema": {
            "patternProperties": {
                "f.*o": {"type": "integer"}
            }
        },
        "tests": [
            {
                "description": "a single valid match is valid",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "multiple valid matches is valid",
                "data": {"foo": 1, "foooooo" : 2},
                "valid": true
            },
            {
                "description": "a single invalid match is invalid",
                "data": {"foo": "bar", "fooooo": 2},
                "valid": false
            },
            {
                "description": "multiple invalid matches is invalid",
                "data": {"foo": "bar", "foooooo" : "baz"},
                "valid": false
            },
            {
                "description": "ignores non-objects",
                "data": 12,
                "valid": true
            }
        ]
    },
    {
        "description": "multiple simultaneous patternProperties are validated",
        "schema": {
            "patternProperties": {
                "a*": {"type": "integer"},
                "aaa*": {"maximum": 20}
            }
        },
        "tests": [
            {
                "description": "a single valid match is valid",
                "data": {"a": 21},
                "valid": true
            },
            {
                "description": "a simultaneous match is valid",
                "data": {"aaaa": 18},
                "valid": true
            },
            {
                "description": "multiple matches is valid",
                "data": {"a": 21, "aaaa": 18},
                "valid": true
            },
            {
                "description": "an invalid due to one is invalid",
                "data": {"a": "bar"},
                "valid": false
            },
            {
                "description": "an invalid due to the other is invalid",
                "data": {"aaaa": 31},
                "valid": false
            },
            {
                "description": "an invalid due to both is invalid",
                "data": {"aaa": "foo", "aaaa": 31},
                "valid": false
            }
        ]
    },
    {
        "description": "regexes are not anchored by default and are case sensitive",
        "schema": {
            "patternProperties": {
                "[0-9]{2,}": { "type": "boolean" },
                "X_": { "type": "string" }
            }
        },
        "tests": [
            {
                "description": "non recognized members are ignored",
                "data": { "answer 1": "42" },
                "valid": true
            },
            {
                "description": "recognized members are accounted for",
                "data": { "a31b": null },
                "valid": false
            },
            {
                "description": "regexes are case sensitive",
                "data": { "a_x_3": 3 },
                "valid": true
            },
            {
                "description": "regexes are case sensitive, 2",
                "data": { "a_X_3": 3 },
                "valid": false
            }
        ]
    }
]

},{}],40:[function(require,module,exports){
module.exports=[
    {
        "description": "object properties validation",
        "schema": {
            "properties": {
                "foo": {"type": "integer"},
                "bar": {"type": "string"}
            }
        },
        "tests": [
            {
                "description": "both properties present and valid is valid",
                "data": {"foo": 1, "bar": "baz"},
                "valid": true
            },
            {
                "description": "one property invalid is invalid",
                "data": {"foo": 1, "bar": {}},
                "valid": false
            },
            {
                "description": "both properties invalid is invalid",
                "data": {"foo": [], "bar": {}},
                "valid": false
            },
            {
                "description": "doesn't invalidate other properties",
                "data": {"quux": []},
                "valid": true
            },
            {
                "description": "ignores non-objects",
                "data": [],
                "valid": true
            }
        ]
    },
    {
        "description":
            "properties, patternProperties, additionalProperties interaction",
        "schema": {
            "properties": {
                "foo": {"type": "array", "maxItems": 3},
                "bar": {"type": "array"}
            },
            "patternProperties": {"f.o": {"minItems": 2}},
            "additionalProperties": {"type": "integer"}
        },
        "tests": [
            {
                "description": "property validates property",
                "data": {"foo": [1, 2]},
                "valid": true
            },
            {
                "description": "property invalidates property",
                "data": {"foo": [1, 2, 3, 4]},
                "valid": false
            },
            {
                "description": "patternProperty invalidates property",
                "data": {"foo": []},
                "valid": false
            },
            {
                "description": "patternProperty validates nonproperty",
                "data": {"fxo": [1, 2]},
                "valid": true
            },
            {
                "description": "patternProperty invalidates nonproperty",
                "data": {"fxo": []},
                "valid": false
            },
            {
                "description": "additionalProperty ignores property",
                "data": {"bar": []},
                "valid": true
            },
            {
                "description": "additionalProperty validates others",
                "data": {"quux": 3},
                "valid": true
            },
            {
                "description": "additionalProperty invalidates others",
                "data": {"quux": "foo"},
                "valid": false
            }
        ]
    }
]

},{}],41:[function(require,module,exports){
module.exports=[
    {
        "description": "root pointer ref",
        "schema": {
            "properties": {
                "foo": {"$ref": "#"}
            },
            "additionalProperties": false
        },
        "tests": [
            {
                "description": "match",
                "data": {"foo": false},
                "valid": true
            },
            {
                "description": "recursive match",
                "data": {"foo": {"foo": false}},
                "valid": true
            },
            {
                "description": "mismatch",
                "data": {"bar": false},
                "valid": false
            },
            {
                "description": "recursive mismatch",
                "data": {"foo": {"bar": false}},
                "valid": false
            }
        ]
    },
    {
        "description": "relative pointer ref to object",
        "schema": {
            "properties": {
                "foo": {"type": "integer"},
                "bar": {"$ref": "#/properties/foo"}
            }
        },
        "tests": [
            {
                "description": "match",
                "data": {"bar": 3},
                "valid": true
            },
            {
                "description": "mismatch",
                "data": {"bar": true},
                "valid": false
            }
        ]
    },
    {
        "description": "relative pointer ref to array",
        "schema": {
            "items": [
                {"type": "integer"},
                {"$ref": "#/items/0"}
            ]
        },
        "tests": [
            {
                "description": "match array",
                "data": [1, 2],
                "valid": true
            },
            {
                "description": "mismatch array",
                "data": [1, "foo"],
                "valid": false
            }
        ]
    },
    {
        "description": "escaped pointer ref",
        "schema": {
            "tilda~field": {"type": "integer"},
            "slash/field": {"type": "integer"},
            "percent%field": {"type": "integer"},
            "properties": {
                "tilda": {"$ref": "#/tilda~0field"},
                "slash": {"$ref": "#/slash~1field"},
                "percent": {"$ref": "#/percent%25field"}
            }
        },
        "tests": [
            {
                "description": "slash",
                "data": {"slash": "aoeu"},
                "valid": false
            },
            {
                "description": "tilda",
                "data": {"tilda": "aoeu"},
                "valid": false
            },
            {
                "description": "percent",
                "data": {"percent": "aoeu"},
                "valid": false
            }
        ]
    },
    {
        "description": "nested refs",
        "schema": {
            "definitions": {
                "a": {"type": "integer"},
                "b": {"$ref": "#/definitions/a"},
                "c": {"$ref": "#/definitions/b"}
            },
            "$ref": "#/definitions/c"
        },
        "tests": [
            {
                "description": "nested ref valid",
                "data": 5,
                "valid": true
            },
            {
                "description": "nested ref invalid",
                "data": "a",
                "valid": false
            }
        ]
    },
    {
        "description": "remote ref, containing refs itself",
        "schema": {"$ref": "http://json-schema.org/draft-04/schema#"},
        "tests": [
            {
                "description": "remote ref valid",
                "data": {"minLength": 1},
                "valid": true
            },
            {
                "description": "remote ref invalid",
                "data": {"minLength": -1},
                "valid": false
            }
        ]
    }
]

},{}],42:[function(require,module,exports){
module.exports=[
    {
        "description": "remote ref",
        "schema": {"$ref": "http://localhost:1234/integer.json"},
        "tests": [
            {
                "description": "remote ref valid",
                "data": 1,
                "valid": true
            },
            {
                "description": "remote ref invalid",
                "data": "a",
                "valid": false
            }
        ]
    },
    {
        "description": "fragment within remote ref",
        "schema": {"$ref": "http://localhost:1234/subSchemas.json#/integer"},
        "tests": [
            {
                "description": "remote fragment valid",
                "data": 1,
                "valid": true
            },
            {
                "description": "remote fragment invalid",
                "data": "a",
                "valid": false
            }
        ]
    },
    {
        "description": "ref within remote ref",
        "schema": {
            "$ref": "http://localhost:1234/subSchemas.json#/refToInteger"
        },
        "tests": [
            {
                "description": "ref within ref valid",
                "data": 1,
                "valid": true
            },
            {
                "description": "ref within ref invalid",
                "data": "a",
                "valid": false
            }
        ]
    },
    {
        "description": "change resolution scope",
        "schema": {
            "id": "http://localhost:1234/",
            "items": {
                "id": "folder/",
                "items": {"$ref": "folderInteger.json"}
            }
        },
        "tests": [
            {
                "description": "changed scope ref valid",
                "data": [[1]],
                "valid": true
            },
            {
                "description": "changed scope ref invalid",
                "data": [["a"]],
                "valid": false
            }
        ]
    }
]

},{}],43:[function(require,module,exports){
module.exports=[
    {
        "description": "required validation",
        "schema": {
            "properties": {
                "foo": {},
                "bar": {}
            },
            "required": ["foo"]
        },
        "tests": [
            {
                "description": "present required property is valid",
                "data": {"foo": 1},
                "valid": true
            },
            {
                "description": "non-present required property is invalid",
                "data": {"bar": 1},
                "valid": false
            }
        ]
    },
    {
        "description": "required default validation",
        "schema": {
            "properties": {
                "foo": {}
            }
        },
        "tests": [
            {
                "description": "not required by default",
                "data": {},
                "valid": true
            }
        ]
    }
]

},{}],44:[function(require,module,exports){
module.exports=[
    {
        "description": "integer type matches integers",
        "schema": {"type": "integer"},
        "tests": [
            {
                "description": "an integer is an integer",
                "data": 1,
                "valid": true
            },
            {
                "description": "a float is not an integer",
                "data": 1.1,
                "valid": false
            },
            {
                "description": "a string is not an integer",
                "data": "foo",
                "valid": false
            },
            {
                "description": "an object is not an integer",
                "data": {},
                "valid": false
            },
            {
                "description": "an array is not an integer",
                "data": [],
                "valid": false
            },
            {
                "description": "a boolean is not an integer",
                "data": true,
                "valid": false
            },
            {
                "description": "null is not an integer",
                "data": null,
                "valid": false
            }
        ]
    },
    {
        "description": "number type matches numbers",
        "schema": {"type": "number"},
        "tests": [
            {
                "description": "an integer is a number",
                "data": 1,
                "valid": true
            },
            {
                "description": "a float is a number",
                "data": 1.1,
                "valid": true
            },
            {
                "description": "a string is not a number",
                "data": "foo",
                "valid": false
            },
            {
                "description": "an object is not a number",
                "data": {},
                "valid": false
            },
            {
                "description": "an array is not a number",
                "data": [],
                "valid": false
            },
            {
                "description": "a boolean is not a number",
                "data": true,
                "valid": false
            },
            {
                "description": "null is not a number",
                "data": null,
                "valid": false
            }
        ]
    },
    {
        "description": "string type matches strings",
        "schema": {"type": "string"},
        "tests": [
            {
                "description": "1 is not a string",
                "data": 1,
                "valid": false
            },
            {
                "description": "a float is not a string",
                "data": 1.1,
                "valid": false
            },
            {
                "description": "a string is a string",
                "data": "foo",
                "valid": true
            },
            {
                "description": "an object is not a string",
                "data": {},
                "valid": false
            },
            {
                "description": "an array is not a string",
                "data": [],
                "valid": false
            },
            {
                "description": "a boolean is not a string",
                "data": true,
                "valid": false
            },
            {
                "description": "null is not a string",
                "data": null,
                "valid": false
            }
        ]
    },
    {
        "description": "object type matches objects",
        "schema": {"type": "object"},
        "tests": [
            {
                "description": "an integer is not an object",
                "data": 1,
                "valid": false
            },
            {
                "description": "a float is not an object",
                "data": 1.1,
                "valid": false
            },
            {
                "description": "a string is not an object",
                "data": "foo",
                "valid": false
            },
            {
                "description": "an object is an object",
                "data": {},
                "valid": true
            },
            {
                "description": "an array is not an object",
                "data": [],
                "valid": false
            },
            {
                "description": "a boolean is not an object",
                "data": true,
                "valid": false
            },
            {
                "description": "null is not an object",
                "data": null,
                "valid": false
            }
        ]
    },
    {
        "description": "array type matches arrays",
        "schema": {"type": "array"},
        "tests": [
            {
                "description": "an integer is not an array",
                "data": 1,
                "valid": false
            },
            {
                "description": "a float is not an array",
                "data": 1.1,
                "valid": false
            },
            {
                "description": "a string is not an array",
                "data": "foo",
                "valid": false
            },
            {
                "description": "an object is not an array",
                "data": {},
                "valid": false
            },
            {
                "description": "an array is not an array",
                "data": [],
                "valid": true
            },
            {
                "description": "a boolean is not an array",
                "data": true,
                "valid": false
            },
            {
                "description": "null is not an array",
                "data": null,
                "valid": false
            }
        ]
    },
    {
        "description": "boolean type matches booleans",
        "schema": {"type": "boolean"},
        "tests": [
            {
                "description": "an integer is not a boolean",
                "data": 1,
                "valid": false
            },
            {
                "description": "a float is not a boolean",
                "data": 1.1,
                "valid": false
            },
            {
                "description": "a string is not a boolean",
                "data": "foo",
                "valid": false
            },
            {
                "description": "an object is not a boolean",
                "data": {},
                "valid": false
            },
            {
                "description": "an array is not a boolean",
                "data": [],
                "valid": false
            },
            {
                "description": "a boolean is not a boolean",
                "data": true,
                "valid": true
            },
            {
                "description": "null is not a boolean",
                "data": null,
                "valid": false
            }
        ]
    },
    {
        "description": "null type matches only the null object",
        "schema": {"type": "null"},
        "tests": [
            {
                "description": "an integer is not null",
                "data": 1,
                "valid": false
            },
            {
                "description": "a float is not null",
                "data": 1.1,
                "valid": false
            },
            {
                "description": "a string is not null",
                "data": "foo",
                "valid": false
            },
            {
                "description": "an object is not null",
                "data": {},
                "valid": false
            },
            {
                "description": "an array is not null",
                "data": [],
                "valid": false
            },
            {
                "description": "a boolean is not null",
                "data": true,
                "valid": false
            },
            {
                "description": "null is null",
                "data": null,
                "valid": true
            }
        ]
    },
    {
        "description": "multiple types can be specified in an array",
        "schema": {"type": ["integer", "string"]},
        "tests": [
            {
                "description": "an integer is valid",
                "data": 1,
                "valid": true
            },
            {
                "description": "a string is valid",
                "data": "foo",
                "valid": true
            },
            {
                "description": "a float is invalid",
                "data": 1.1,
                "valid": false
            },
            {
                "description": "an object is invalid",
                "data": {},
                "valid": false
            },
            {
                "description": "an array is invalid",
                "data": [],
                "valid": false
            },
            {
                "description": "a boolean is invalid",
                "data": true,
                "valid": false
            },
            {
                "description": "null is invalid",
                "data": null,
                "valid": false
            }
        ]
    }
]

},{}],45:[function(require,module,exports){
module.exports=[
    {
        "description": "uniqueItems validation",
        "schema": {"uniqueItems": true},
        "tests": [
            {
                "description": "unique array of integers is valid",
                "data": [1, 2],
                "valid": true
            },
            {
                "description": "non-unique array of integers is invalid",
                "data": [1, 1],
                "valid": false
            },
            {
                "description": "numbers are unique if mathematically unequal",
                "data": [1.0, 1.00, 1],
                "valid": false
            },
            {
                "description": "unique array of objects is valid",
                "data": [{"foo": "bar"}, {"foo": "baz"}],
                "valid": true
            },
            {
                "description": "non-unique array of objects is invalid",
                "data": [{"foo": "bar"}, {"foo": "bar"}],
                "valid": false
            },
            {
                "description": "unique array of nested objects is valid",
                "data": [
                    {"foo": {"bar" : {"baz" : true}}},
                    {"foo": {"bar" : {"baz" : false}}}
                ],
                "valid": true
            },
            {
                "description": "non-unique array of nested objects is invalid",
                "data": [
                    {"foo": {"bar" : {"baz" : true}}},
                    {"foo": {"bar" : {"baz" : true}}}
                ],
                "valid": false
            },
            {
                "description": "unique array of arrays is valid",
                "data": [["foo"], ["bar"]],
                "valid": true
            },
            {
                "description": "non-unique array of arrays is invalid",
                "data": [["foo"], ["foo"]],
                "valid": false
            },
            {
                "description": "1 and true are unique",
                "data": [1, true],
                "valid": true
            },
            {
                "description": "0 and false are unique",
                "data": [0, false],
                "valid": true
            },
            {
                "description": "unique heterogeneous types are valid",
                "data": [{}, [1], true, null, 1],
                "valid": true
            },
            {
                "description": "non-unique heterogeneous types are invalid",
                "data": [{}, [1], true, null, {}, 1],
                "valid": false
            }
        ]
    }
]

},{}],46:[function(require,module,exports){
"use strict";

var ZSchema = require("../../src/ZSchema");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));
ZSchema.setRemoteReference("http://localhost:1234/integer.json", require("../jsonSchemaTestSuite/remotes/integer.json"));
ZSchema.setRemoteReference("http://localhost:1234/subSchemas.json", require("../jsonSchemaTestSuite/remotes/subSchemas.json"));
ZSchema.setRemoteReference("http://localhost:1234/folder/folderInteger.json", require("../jsonSchemaTestSuite/remotes/folder/folderInteger.json"));

describe("Basic", function () {

    it("ZSchema constructor should take one argument - options", function () {
        expect(ZSchema.length).toBe(1);
    });

    it("Work in progress test...", function () {
        var validator = new ZSchema();
        var schema = {
            "id": "http://localhost:1234/",
            "items": {
                "id": "folder/",
                "items": { "$ref": "folderInteger.json" }
            }
        };
        var data = [[1]];
        var valid = validator.validate(data, schema);
        if (!valid) {
            console.log(validator.getLastError());
        }
        expect(valid).toBe(true);
    });

});

},{"../../src/ZSchema":"C768cZ","../files/draft-04-schema.json":13,"../jsonSchemaTestSuite/remotes/folder/folderInteger.json":14,"../jsonSchemaTestSuite/remotes/integer.json":15,"../jsonSchemaTestSuite/remotes/subSchemas.json":16}],47:[function(require,module,exports){
"use strict";

var ZSchema = require("../../src/ZSchema");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));
ZSchema.setRemoteReference("http://localhost:1234/integer.json", require("../jsonSchemaTestSuite/remotes/integer.json"));
ZSchema.setRemoteReference("http://localhost:1234/subSchemas.json", require("../jsonSchemaTestSuite/remotes/subSchemas.json"));
ZSchema.setRemoteReference("http://localhost:1234/folder/folderInteger.json", require("../jsonSchemaTestSuite/remotes/folder/folderInteger.json"));

var jsonSchemaTestSuiteFiles = [
    require("../jsonSchemaTestSuite/tests/draft4/additionalItems.json"),
    require("../jsonSchemaTestSuite/tests/draft4/additionalProperties.json"),
    require("../jsonSchemaTestSuite/tests/draft4/allOf.json"),
    require("../jsonSchemaTestSuite/tests/draft4/anyOf.json"),
    require("../jsonSchemaTestSuite/tests/draft4/definitions.json"),
    require("../jsonSchemaTestSuite/tests/draft4/dependencies.json"),
    require("../jsonSchemaTestSuite/tests/draft4/enum.json"),
    require("../jsonSchemaTestSuite/tests/draft4/items.json"),
    require("../jsonSchemaTestSuite/tests/draft4/maxItems.json"),
    require("../jsonSchemaTestSuite/tests/draft4/maxLength.json"),
    require("../jsonSchemaTestSuite/tests/draft4/maxProperties.json"),
    require("../jsonSchemaTestSuite/tests/draft4/maximum.json"),
    require("../jsonSchemaTestSuite/tests/draft4/minItems.json"),
    require("../jsonSchemaTestSuite/tests/draft4/minLength.json"),
    require("../jsonSchemaTestSuite/tests/draft4/minProperties.json"),
    require("../jsonSchemaTestSuite/tests/draft4/minimum.json"),
    require("../jsonSchemaTestSuite/tests/draft4/multipleOf.json"),
    require("../jsonSchemaTestSuite/tests/draft4/not.json"),
    require("../jsonSchemaTestSuite/tests/draft4/oneOf.json"),
    require("../jsonSchemaTestSuite/tests/draft4/pattern.json"),
    require("../jsonSchemaTestSuite/tests/draft4/patternProperties.json"),
    require("../jsonSchemaTestSuite/tests/draft4/properties.json"),
    require("../jsonSchemaTestSuite/tests/draft4/ref.json"),
    require("../jsonSchemaTestSuite/tests/draft4/refRemote.json"),
    require("../jsonSchemaTestSuite/tests/draft4/required.json"),
    require("../jsonSchemaTestSuite/tests/draft4/type.json"),
    require("../jsonSchemaTestSuite/tests/draft4/uniqueItems.json"),
    // optional
    require("../jsonSchemaTestSuite/tests/draft4/optional/bignum.json"),
    require("../jsonSchemaTestSuite/tests/draft4/optional/format.json")
    // zeroTerminatedFloats.json is excluded because JavaScript doesn't distinguish between different types of numeric values
    // require("../jsonSchemaTestSuite/tests/draft4/optional/zeroTerminatedFloats.json")
];

var testExcludes = [
    "an invalid URI",
    "an invalid URI though valid URI reference",
    "one supplementary Unicode code point is not long enough",
    "two supplementary Unicode code points is long enough"
];

describe("JsonSchemaTestSuite", function () {

    it("should contain 29 files", function () {
        expect(jsonSchemaTestSuiteFiles.length).toBe(29);
    });

    jsonSchemaTestSuiteFiles.forEach(function (testDefinitions, fileIndex) {

        testDefinitions.forEach(function (testDefinition) {

            testDefinition.tests.forEach(function (test) {

                if (testExcludes.indexOf(test.description) !== -1) { return; }

                it("[" + fileIndex + "]" + testDefinition.description + " - " + test.description + ": " + JSON.stringify(test.data), function () {

                    var validator = new ZSchema();
                    var valid = validator.validate(test.data, testDefinition.schema);
                    expect(valid).toBe(test.valid);

                    if (valid !== test.valid) {
                        if (!valid) {
                            var errors = validator.getLastError();
                            expect(errors).toBe(null);
                        }
                    }

                });

            });

        });

    });

});

},{"../../src/ZSchema":"C768cZ","../files/draft-04-schema.json":13,"../jsonSchemaTestSuite/remotes/folder/folderInteger.json":14,"../jsonSchemaTestSuite/remotes/integer.json":15,"../jsonSchemaTestSuite/remotes/subSchemas.json":16,"../jsonSchemaTestSuite/tests/draft4/additionalItems.json":17,"../jsonSchemaTestSuite/tests/draft4/additionalProperties.json":18,"../jsonSchemaTestSuite/tests/draft4/allOf.json":19,"../jsonSchemaTestSuite/tests/draft4/anyOf.json":20,"../jsonSchemaTestSuite/tests/draft4/definitions.json":21,"../jsonSchemaTestSuite/tests/draft4/dependencies.json":22,"../jsonSchemaTestSuite/tests/draft4/enum.json":23,"../jsonSchemaTestSuite/tests/draft4/items.json":24,"../jsonSchemaTestSuite/tests/draft4/maxItems.json":25,"../jsonSchemaTestSuite/tests/draft4/maxLength.json":26,"../jsonSchemaTestSuite/tests/draft4/maxProperties.json":27,"../jsonSchemaTestSuite/tests/draft4/maximum.json":28,"../jsonSchemaTestSuite/tests/draft4/minItems.json":29,"../jsonSchemaTestSuite/tests/draft4/minLength.json":30,"../jsonSchemaTestSuite/tests/draft4/minProperties.json":31,"../jsonSchemaTestSuite/tests/draft4/minimum.json":32,"../jsonSchemaTestSuite/tests/draft4/multipleOf.json":33,"../jsonSchemaTestSuite/tests/draft4/not.json":34,"../jsonSchemaTestSuite/tests/draft4/oneOf.json":35,"../jsonSchemaTestSuite/tests/draft4/optional/bignum.json":36,"../jsonSchemaTestSuite/tests/draft4/optional/format.json":37,"../jsonSchemaTestSuite/tests/draft4/pattern.json":38,"../jsonSchemaTestSuite/tests/draft4/patternProperties.json":39,"../jsonSchemaTestSuite/tests/draft4/properties.json":40,"../jsonSchemaTestSuite/tests/draft4/ref.json":41,"../jsonSchemaTestSuite/tests/draft4/refRemote.json":42,"../jsonSchemaTestSuite/tests/draft4/required.json":43,"../jsonSchemaTestSuite/tests/draft4/type.json":44,"../jsonSchemaTestSuite/tests/draft4/uniqueItems.json":45}],48:[function(require,module,exports){
/*jshint -W030 */

"use strict";

var ZSchema = require("../../src/ZSchema");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));

var testSuiteFiles = [
    require("../ZSchemaTestSuite/CustomFormats.js"),
    require("../ZSchemaTestSuite/CustomFormatsAsync.js"),
    require("../ZSchemaTestSuite/ForceAdditional.js"),
    require("../ZSchemaTestSuite/ForceItems.js"),
    require("../ZSchemaTestSuite/ForceMaxLength.js"),
    require("../ZSchemaTestSuite/ForceProperties.js"),
    require("../ZSchemaTestSuite/IgnoreUnresolvableReferences.js"),
    require("../ZSchemaTestSuite/AssumeAdditional.js"),
    require("../ZSchemaTestSuite/NoEmptyStrings.js"),
    require("../ZSchemaTestSuite/NoTypeless.js"),
    require("../ZSchemaTestSuite/NoExtraKeywords.js"),
    require("../ZSchemaTestSuite/StrictUris.js")
];

describe("ZSchemaTestSuite", function () {

    var idx = testSuiteFiles.length;
    while (idx--) {
        if (testSuiteFiles[idx] == null) {
            testSuiteFiles.splice(idx, 1);
        }
    }

    it("should contain 12 files", function () {
        expect(testSuiteFiles.length).toBe(12);
    });

    testSuiteFiles.forEach(function (testSuite) {

        testSuite.tests.forEach(function (test) {

            var data = test.data;
            if (typeof data === "undefined") {
                data = testSuite.data;
            }

            var async               = test.async              || testSuite.async   || false,
                options             = test.options            || testSuite.options || undefined,
                setup               = test.setup              || testSuite.setup,
                schema              = test.schema             || testSuite.schema,
                after               = test.after              || testSuite.after,
                validateSchemaOnly  = test.validateSchemaOnly || testSuite.validateSchemaOnly;

            !async && it(testSuite.description + ", " + test.description, function () {

                var validator = new ZSchema(options);
                if (setup) { setup(validator, ZSchema); }

                var valid;
                if (validateSchemaOnly) {
                    valid = validator.validateSchema(schema);
                } else {
                    valid = validator.validate(data, schema);
                }
                var err = validator.getLastError();

                expect(typeof valid).toBe("boolean", "returned response is not a boolean");
                expect(valid).toBe(test.valid, "test result doesn't match expected test result");
                if (test.valid === true) {
                    expect(err).toBe(undefined, "errors are not undefined when test is valid");
                }
                if (after) {
                    after(err, valid);
                }

            });

            async && it(testSuite.description + ", " + test.description, function (done) {

                var validator = new ZSchema(options);
                if (setup) { setup(validator, ZSchema); }

                // see http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony
                var zalgo = false;

                var result = validator.validate(data, schema, function (err, valid) {
                    // make sure callback wasn't called synchronously
                    expect(zalgo).toBe(true, "callback was fired in synchronous way");
                    expect(typeof valid).toBe("boolean", "returned response is not a boolean");
                    expect(valid).toBe(test.valid, "test result doesn't match expected test result");
                    if (test.valid === true) {
                        expect(err).toBe(undefined, "errors are not undefined when test is valid");
                    }
                    if (after) {
                        after(err, valid);
                    }
                    done();

                });

                // never return anything when callback is specified
                expect(result).toBe(undefined, "validator returned something else than undefined in callback mode");
                zalgo = true;

            });

        });

    });

});

},{"../../src/ZSchema":"C768cZ","../ZSchemaTestSuite/AssumeAdditional.js":1,"../ZSchemaTestSuite/CustomFormats.js":2,"../ZSchemaTestSuite/CustomFormatsAsync.js":3,"../ZSchemaTestSuite/ForceAdditional.js":4,"../ZSchemaTestSuite/ForceItems.js":5,"../ZSchemaTestSuite/ForceMaxLength.js":6,"../ZSchemaTestSuite/ForceProperties.js":7,"../ZSchemaTestSuite/IgnoreUnresolvableReferences.js":8,"../ZSchemaTestSuite/NoEmptyStrings.js":9,"../ZSchemaTestSuite/NoExtraKeywords.js":10,"../ZSchemaTestSuite/NoTypeless.js":11,"../ZSchemaTestSuite/StrictUris.js":12,"../files/draft-04-schema.json":13}]},{},[46,47,48]);

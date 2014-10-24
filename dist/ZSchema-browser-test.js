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
        Class.registerFormat("fillHello", function (obj) {
            obj.hello = "world";
            return true;
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
        },
        {
            description: "should be able to modify object using format",
            data: {},
            schema: {
                "type": "object",
                "format": "fillHello"
            },
            valid: true,
            after: function (err, valid, obj) {
                expect(obj.hello).toBe("world");
            }
        }
    ]
};

},{}],3:[function(require,module,exports){
"use strict";

module.exports = {
    description: "registerFormat - Custom formats async support",
    async: true,
    options: {
        asyncTimeout: 500
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
    description: "reportPathAsArray - Report error paths as an array of path segments",
    options: {
        reportPathAsArray: true
    },
    tests: [
        {
            description: "should fail validation and report error paths as an array of path segments",
            schema: {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "invalid"
                  }
                }
            },
            valid: false,
            validateSchemaOnly: true,
            after: function (err) {
                expect(err[0].path).toEqual(["properties", "name"]);
            }
        }
    ]
};

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #12 - validation should fail when missing a reference",
    tests: [
        {
            description: "should pass validation",
            schema: {
                "id": "http://my.site/myschema#",
                "$ref": "#/definitions/schema2",
                "definitions": {
                    "schema1": {
                        "id": "schema1",
                        "type": "integer"
                    },
                    "schema2": {
                        "type": "array",
                        "items": {
                            "$ref": "schema1"
                        }
                    }
                }
            },
            data: [1, 2, 3],
            valid: true
        },
        {
            description: "should fail validation",
            schema: {
                "id": "http://my.site/myschema#",
                "$ref": "#/definitions/schema2",
                "definitions": {
                    "schema1": {
                        "id": "schema1",
                        "type": "integer"
                    },
                    "schema2": {
                        "type": "array",
                        "items": {
                            "$ref": "schema1"
                        }
                    }
                }
            },
            data: ["1", null, 3],
            valid: false
        },
        {
            description: "should fail compilation with unresolvable reference",
            schema: {
                id: "schemaA",
                type: "object",
                properties: {
                    a: {
                        type: "integer"
                    },
                    b: {
                        type: "string"
                    },
                    c: {
                        $ref: "schemaB"
                    }
                },
                required: ["a"]
            },
            validateSchemaOnly: true,
            valid: false,
            after: function (err) {
                expect(err[0].code).toBe("UNRESOLVABLE_REFERENCE");
            }
        }
    ]
};

},{}],11:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #13 - compile multiple schemas tied together with an id",
    tests: [
        {
            description: "mainSchema should fail compilation on its own",
            schema: {
                id: "mainSchema",
                type: "object",
                properties: {
                    a: {"$ref": "schemaA"},
                    b: {"$ref": "schemaB"},
                    c: {"enum": ["C"]}
                }
            },
            validateSchemaOnly: true,
            valid: false
        },
        {
            description: "mainSchema should pass compilation if schemaA and schemaB were already compiled, order #1",
            schema: [
                {
                    id: "schemaA",
                    type: "integer"
                },
                {
                    id: "schemaB",
                    type: "string"
                },
                {
                    id: "mainSchema",
                    type: "object",
                    properties: {
                        a: {"$ref": "schemaA"},
                        b: {"$ref": "schemaB"},
                        c: {"enum": ["C"]}
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "mainSchema should pass compilation if schemaA and schemaB were already compiled, order #2",
            schema: [
                {
                    id: "mainSchema",
                    type: "object",
                    properties: {
                        a: {"$ref": "schemaA"},
                        b: {"$ref": "schemaB"},
                        c: {"enum": ["C"]}
                    }
                },
                {
                    id: "schemaA",
                    type: "integer"
                },
                {
                    id: "schemaB",
                    type: "string"
                }
            ],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "compilation should never end up in infinite loop #1",
            schema: [
                {
                    id: "mainSchema",
                    type: "object",
                    properties: {
                        a: {"$ref": "schemaA"},
                        b: {"$ref": "schemaB"},
                        c: {"enum": ["C"]}
                    }
                },
                {
                    id: "schemaB",
                    type: "string"
                }
            ],
            validateSchemaOnly: true,
            valid: false
        },
        {
            description: "compilation should never end up in infinite loop #2",
            schema: [
                {
                    id: "schemaB",
                    type: "string"
                },
                {
                    id: "mainSchema",
                    type: "object",
                    properties: {
                        a: {"$ref": "schemaA"},
                        b: {"$ref": "schemaB"},
                        c: {"enum": ["C"]}
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: false
        },
        {
            description: "should validate object successfully",
            schema: [
                {
                    id: "schemaA",
                    type: "integer"
                },
                {
                    id: "schemaB",
                    type: "string"
                },
                {
                    id: "mainSchema",
                    type: "object",
                    properties: {
                        a: {"$ref": "schemaA"},
                        b: {"$ref": "schemaB"},
                        c: {"enum": ["C"]}
                    }
                }
            ],
            schemaIndex: 2,
            data: {
                a: 1,
                b: "str",
                c: "C"
            },
            valid: true
        },
        {
            description: "should fail validating object",
            schema: [
                {
                    id: "schemaA",
                    type: "integer"
                },
                {
                    id: "schemaB",
                    type: "string"
                },
                {
                    id: "mainSchema",
                    type: "object",
                    properties: {
                        a: {"$ref": "schemaA"},
                        b: {"$ref": "schemaB"},
                        c: {"enum": ["C"]}
                    }
                }
            ],
            schemaIndex: 2,
            data: {
                a: "str",
                b: 1,
                c: "C"
            },
            valid: false,
            after: function (err) {
                expect(err[0].code).toBe("INVALID_TYPE");
                expect(err[1].code).toBe("INVALID_TYPE");
            }
        }
    ]
};

},{}],12:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #16 - schemas should be validated by references in $schema property",
    tests: [
        {
            description: "should pass validation",
            schema: {
                $schema: "http://json-schema.org/draft-04/hyper-schema#",
                links: []
            },
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should fail validation",
            schema: {
                $schema: "http://json-schema.org/draft-04/hyper-schema#",
                links: null
            },
            validateSchemaOnly: true,
            valid: false
        }
    ]
};

},{}],13:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #22 - recursive references",
    tests: [
        {
            description: "should pass validation",
            schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                    "is_and": { type: "boolean" },
                    "filters": {
                        type: "array",
                        additionalItems: false,
                        items: {
                            oneOf: [
                                { $ref: "#" },
                                { $ref: "#/definitions/last" }
                            ]
                        }
                    }
                },
                definitions: {
                    "last": {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            "text": { type: "string" },
                            "is_last": { type: "boolean" },
                            "filters": { type: "array", additionalItems: false }
                        }
                    }
                }
            },
            data: {
                "is_and": false,
                "filters": [
                    {
                        "is_and": false,
                        "filters": [
                            {
                                "is_and": true,
                                "filters": [
                                    {
                                        "is_and": true,
                                        "filters": [
                                            {
                                                "is_and": true,
                                                "filters": [
                                                    {
                                                        "is_and": true,
                                                        "filters": [
                                                            {
                                                                "text": "ABC",
                                                                "is_last": true,
                                                                "filters": []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            valid: true
        }
    ]
};

},{}],14:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #25 - hostname format behaviour",
    tests: [
        {
            description: "should pass validation",
            schema: {
                "$schema": "http://json-schema.org/draft-04/schema#",
                "type": "object",
                "properties": {
                    "ipAddress": {
                        "type": "string",
                        "oneOf": [
                            {
                                "format": "hostname"
                            },
                            {
                                "format": "ipv4"
                            },
                            {
                                "format": "ipv6"
                            }
                        ]
                    }
                }
            },
            data: {
                "ipAddress": "127.0.0.1"
            },
            valid: true
        }
    ]
};

},{}],15:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #26 - noTypeless behaviour",
    options: {
        noTypeless: true
    },
    tests: [
        {
            description: "should pass validation",
            schema: {
                "oneOf": [
                    { $ref: "#/definitions/str" },
                    { $ref: "#/definitions/num" }
                ],
                "definitions": {
                    "str": {
                        "type": "string"
                    },
                    "num": {
                        "type": "number"
                    }
                }
            },
            data: "string",
            valid: true
        },
        {
            description: "should fail validation",
            schema: {
                "oneOf": [
                    { $ref: "#/definitions/str" },
                    { $ref: "#/definitions/num" }
                ],
                "definitions": {
                    "str": {
                        "type": "string"
                    },
                    "num": {
                        "type": "number"
                    }
                }
            },
            data: true,
            valid: false
        },
        {
            description: "should fail validation because one of the definitions doesn't have a type",
            schema: {
                "oneOf": [
                    { $ref: "#/definitions/str" },
                    { $ref: "#/definitions/num" }
                ],
                "definitions": {
                    "str": {
                        "type": "string"
                    },
                    "num": {

                    }
                }
            },
            data: "string",
            valid: false,
            after: function (errors) {
                expect(errors[0].code).toBe("KEYWORD_UNDEFINED_STRICT");
            }
        },
        {
            description: "should pass validation because type is defined by parent",
            schema: {
                type: "object",
                properties: {
                    "prop1": { type: "string" },
                    "prop2": { type: "string" }
                },
                anyOf: [
                    { required: ["prop1"] },
                    { required: ["prop2"] }
                ]
            },
            data: {
                prop1: "str"
            },
            valid: true
        }
    ]
};

},{}],16:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #37 - pass schema as an uri to load from cache",
    tests: [
        {
            description: "should pass validation",
            schema: "http://json-schema.org/draft-04/schema",
            data: {
                type: "string"
            },
            valid: true
        },
        {
            description: "should pass validation",
            schema: "http://json-schema.org/draft-04/schema",
            data: {
                type: 1
            },
            valid: false
        }
    ]
};

},{}],17:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #40 - validator ends up in infinite loop",
    tests: [
        {
            description: "should pass validation",
            schema: {
                "$schema": "http://json-schema.org/draft-04/schema#",
                "title": "Product set",
                "is_start": "boolean",
                "hierarchy": {
                    "$ref": "#/definitions/recursion"
                },
                "definitions": {
                    "recursion": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "is_and": {
                                "type": "boolean"
                            },
                            "filters": {
                                "type": "array",
                                "additionalItems": false,
                                "items": {
                                    "$ref": "#/definitions/recursion"
                                }
                            }
                        }
                    }
                }
            },
            data: {
                "is_start": true,
                "hierarchy": {
                    "is_and": false,
                    "filters": [
                        {
                            "is_and": false,
                            "filters": [
                                {
                                    "is_and": true,
                                    "filters": [
                                        {
                                            "is_and": true,
                                            "filters": [
                                                {
                                                    "is_and": true,
                                                    "filters": [
                                                        {
                                                            "is_and": true,
                                                            "filters": [
                                                                {
                                                                    "is_and": true,
                                                                    "filters": []
                                                                }
                                                            ]
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            },
            valid: true
        }
    ]
};

},{}],18:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #41 - invalid schema",
    tests: [
        {
            description: "should fail schema validation",
            schema: {
                "$schema": "http://json-schema.org/draft-04/schema#",
                "id": "http://jsonschema.net#",
                "type": "array",
                "required": false,
                "items": {
                    "id": "http://jsonschema.net/5#",
                    "type": "object",
                    "required": false,
                    "properties": {
                        "identifiers": {
                            "id": "http://jsonschema.net/5/identifiers#",
                            "type": "array",
                            "required": false,
                            "items": {
                                "id": "http://jsonschema.net/5/identifiers/0#",
                                "type": "object",
                                "required": false,
                                "properties": {
                                    "identifier": {
                                        "id": "http://jsonschema.net/5/identifiers/0/identifier#",
                                        "type": "string",
                                        "required": false
                                    }
                                }
                            }
                        },
                        "vital": {
                            "id": "http://jsonschema.net/5/vital#",
                            "type": "object",
                            "required": false,
                            "properties": {
                                "name": {
                                    "id": "http://jsonschema.net/5/vital/name#",
                                    "type": "string",
                                    "required": false
                                },
                                "code": {
                                    "id": "http://jsonschema.net/5/vital/code#",
                                    "type": "string",
                                    "required": false
                                },
                                "code_system_name": {
                                    "id": "http://jsonschema.net/5/vital/code_system_name#",
                                    "type": "string",
                                    "required": false
                                }
                            }
                        },
                        "status": {
                            "id": "http://jsonschema.net/5/status#",
                            "type": "string",
                            "required": false
                        },
                        "date": {
                            "id": "http://jsonschema.net/5/date#",
                            "type": "array",
                            "required": false,
                            "items": {
                                "id": "http://jsonschema.net/5/date/0#",
                                "type": "object",
                                "required": false,
                                "properties": {
                                    "date": {
                                        "id": "http://jsonschema.net/5/date/0/date#",
                                        "type": "string",
                                        "required": false
                                    },
                                    "precision": {
                                        "id": "http://jsonschema.net/5/date/0/precision#",
                                        "type": "string",
                                        "required": false
                                    }
                                }
                            }
                        },
                        "interpretations": {
                            "id": "http://jsonschema.net/5/interpretations#",
                            "type": "array",
                            "required": false,
                            "items": {
                                "id": "http://jsonschema.net/5/interpretations/0#",
                                "type": "string",
                                "required": false
                            }
                        },
                        "value": {
                            "id": "http://jsonschema.net/5/value#",
                            "type": "integer",
                            "required": false
                        },
                        "unit": {
                            "id": "http://jsonschema.net/5/unit#",
                            "type": "string",
                            "required": false
                        }
                    }
                }
            },
            validateSchemaOnly: true,
            valid: false
        }
    ]
};

},{}],19:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #43 - maximum call stack size exceeded error",
    tests: [
        {
            description: "should compile both schemas",
            schema: [
                {
                    "id": "schemaA",
                    "$schema": "http://json-schema.org/draft-04/schema#",
                    "description": "Data type fields (section 4.3.3)",
                    "type": "object",
                    "oneOf": [
                        {
                            "required": ["type"]
                        },
                        {
                            "required": ["$ref"]
                        }
                    ],
                    "properties": {
                        "type": {
                            "type": "string"
                        },
                        "$ref": {
                            "type": "string"
                        },
                        "format": {
                            "type": "string"
                        },
                        "defaultValue": {
                            "not": {
                                "type": ["array", "object", "null"]
                            }
                        },
                        "enum": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "uniqueItems": true,
                            "minItems": 1
                        },
                        "minimum": {
                            "type": "string"
                        },
                        "maximum": {
                            "type": "string"
                        },
                        "items": {
                            "$ref": "#/definitions/itemsObject"
                        },
                        "uniqueItems": {
                            "type": "boolean"
                        }
                    },
                    "dependencies": {
                        "format": {
                            "oneOf": [
                                {
                                    "properties": {
                                        "type": {
                                            "enum": ["integer"]
                                        },
                                        "format": {
                                            "enum": ["int32", "int64"]
                                        }
                                    }
                                },
                                {
                                    "properties": {
                                        "type": {
                                            "enum": ["number"]
                                        },
                                        "format": {
                                            "enum": ["float", "double"]
                                        }
                                    }
                                },
                                {
                                    "properties": {
                                        "type": {
                                            "enum": ["string"]
                                        },
                                        "format": {
                                            "enum": ["byte", "date", "date-time"]
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "definitions": {
                        "itemsObject": {
                            "oneOf": [
                                {
                                    "type": "object",
                                    "required": ["$ref"],
                                    "properties": {
                                        "$ref": {
                                            "type": "string"
                                        }
                                    },
                                    "additionalProperties": false
                                },
                                {
                                    "allOf": [
                                        {
                                            "$ref": "#"
                                        },
                                        {
                                            "required": ["type"],
                                            "properties": {
                                                "type": {},
                                                "format": {}
                                            },
                                            "additionalProperties": false
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    "id": "schemaB",
                    "$schema": "http://json-schema.org/draft-04/schema#",
                    "type": "object",
                    "required": ["id", "properties"],
                    "properties": {
                        "id": {
                            "type": "string"
                        },
                        "description": {
                            "type": "string"
                        },
                        "properties": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/propertyObject"
                            }
                        },
                        "subTypes": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "uniqueItems": true
                        },
                        "discriminator": {
                            "type": "string"
                        }
                    },
                    "dependencies": {
                        "subTypes": ["discriminator"]
                    },
                    "definitions": {
                        "propertyObject": {
                            "allOf": [
                                {
                                    "not": {
                                        "$ref": "#"
                                    }
                                },
                                {
                                    "$ref": "schemaA"
                                }
                            ]
                        }
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: true
        }
    ]
};

},{}],20:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #44 - unresolvable reference due to hash sign",
    tests: [
        {
            description: "should pass validation #1",
            schema: [
                {
                    id: "schemaA",
                    type: "string"
                },
                {
                    id: "schemaB",
                    properties: {
                        a: {
                            "$ref": "schemaA"
                        }
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should pass validation #2",
            schema: [
                {
                    id: "schemaA",
                    type: "string"
                },
                {
                    id: "schemaB",
                    properties: {
                        a: {
                            "$ref": "schemaA#"
                        }
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: true
        }
    ]
};

},{}],21:[function(require,module,exports){
"use strict";

var resourceObject = {
    "id": "resourceObject.json",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "required": ["path"],
    "properties": {
        "path": {
            "type": "string",
            "format": "uri"
        },
        "description": {
            "type": "string"
        }
    },
    "additionalProperties": false
};
var infoObject = {
    "id": "infoObject.json",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "description": "info object (section 5.1.3)",
    "type": "object",
    "required": ["title", "description"],
    "properties": {
        "title": {
            "type": "string"
        },
        "description": {
            "type": "string"
        },
        "termsOfServiceUrl": {
            "type": "string",
            "format": "uri"
        },
        "contact": {
            "type": "string",
            "format": "email"
        },
        "license": {
            "type": "string"
        },
        "licenseUrl": {
            "type": "string",
            "format": "uri"
        }
    },
    "additionalProperties": false
};
var oauth2GrantType = {
    "id": "oauth2GrantType.json",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "minProperties": 1,
    "properties": {
        "implicit": {
            "$ref": "#/definitions/implicit"
        },
        "authorization_code": {
            "$ref": "#/definitions/authorizationCode"
        }
    },
    "definitions": {
        "implicit": {
            "type": "object",
            "required": ["loginEndpoint"],
            "properties": {
                "loginEndpoint": {
                    "$ref": "#/definitions/loginEndpoint"
                },
                "tokenName": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        },
        "authorizationCode": {
            "type": "object",
            "required": ["tokenEndpoint", "tokenRequestEndpoint"],
            "properties": {
                "tokenEndpoint": {
                    "$ref": "#/definitions/tokenEndpoint"
                },
                "tokenRequestEndpoint": {
                    "$ref": "#/definitions/tokenRequestEndpoint"
                }
            },
            "additionalProperties": false
        },
        "loginEndpoint": {
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {
                    "type": "string",
                    "format": "uri"
                }
            },
            "additionalProperties": false
        },
        "tokenEndpoint": {
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {
                    "type": "string",
                    "format": "uri"
                },
                "tokenName": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        },
        "tokenRequestEndpoint": {
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {
                    "type": "string",
                    "format": "uri"
                },
                "clientIdName": {
                    "type": "string"
                },
                "clientSecretName": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        }
    }
};
var authorizationObject = {
    "id": "authorizationObject.json",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "additionalProperties": {
        "oneOf": [
            {
                "$ref": "#/definitions/basicAuth"
      },
            {
                "$ref": "#/definitions/apiKey"
      },
            {
                "$ref": "#/definitions/oauth2"
      }
    ]
    },
    "definitions": {
        "basicAuth": {
            "required": ["type"],
            "properties": {
                "type": {
                    "enum": ["basicAuth"]
                }
            },
            "additionalProperties": false
        },
        "apiKey": {
            "required": ["type", "passAs", "keyname"],
            "properties": {
                "type": {
                    "enum": ["apiKey"]
                },
                "passAs": {
                    "enum": ["header", "query"]
                },
                "keyname": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        },
        "oauth2": {
            "type": "object",
            "required": ["type", "grantTypes"],
            "properties": {
                "type": {
                    "enum": ["oauth2"]
                },
                "scopes": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/oauth2Scope"
                    }
                },
                "grantTypes": {
                    "$ref": "oauth2GrantType.json"
                }
            },
            "additionalProperties": false
        },
        "oauth2Scope": {
            "type": "object",
            "required": ["scope"],
            "properties": {
                "scope": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        }
    }
};
var resourceListing = {
    "id": "resourceListing.json",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "required": ["swaggerVersion", "apis"],
    "properties": {
        "swaggerVersion": {
            "enum": ["1.2"]
        },
        "apis": {
            "type": "array",
            "items": {
                "$ref": "resourceObject.json"
            }
        },
        "apiVersion": {
            "type": "string"
        },
        "info": {
            "$ref": "infoObject.json"
        },
        "authorizations": {
            "$ref": "authorizationObject.json"
        }
    }
};

var schemaCombinations = {
    "authorizationObject.json": [
        oauth2GrantType,
        authorizationObject
    ],
    "infoObject.json": [
        infoObject
    ],
    "oauth2GrantType.json": [
        oauth2GrantType
    ],
    "resourceObject.json": [
        resourceObject
    ],
    "resourceListing.json": [
        resourceObject,
        infoObject,
        oauth2GrantType,
        authorizationObject,
        resourceListing
    ]
};

module.exports = {
    description: "Issue #45 - recompiling schemas results in 'Reference could not be resolved'",
    tests: [
        {
            description: "should pass schema validation #1",
            schema: schemaCombinations["authorizationObject.json"],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should pass schema validation #2",
            schema: schemaCombinations["infoObject.json"],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should pass schema validation #3",
            schema: schemaCombinations["oauth2GrantType.json"],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should pass schema validation #4",
            schema: schemaCombinations["resourceObject.json"],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should pass schema validation #5",
            schema: schemaCombinations["resourceListing.json"],
            validateSchemaOnly: true,
            valid: true
        }
    ]
};

},{}],22:[function(require,module,exports){
"use strict";

var draft4 = require("./files/Issue47/draft4.json");
var modifiedSchema = require("./files/Issue47/swagger_draft_modified.json");
var realSchema = require("./files/Issue47/swagger_draft.json");
var json = require("./files/Issue47/sample.json");

module.exports = {
    description: "Issue #47 - references to draft4 subschema are not working",
    setup: function (validator) {
        validator.setRemoteReference("http://json-schema.orgx/draft-04/schema", draft4);
    },
    tests: [
        {
            description: "should pass validation #1",
            schema: modifiedSchema,
            data: json,
            valid: true
        },
        {
            description: "should pass validation #1",
            schema: realSchema,
            data: json,
            valid: true
        }
    ]
};

},{"./files/Issue47/draft4.json":34,"./files/Issue47/sample.json":35,"./files/Issue47/swagger_draft.json":36,"./files/Issue47/swagger_draft_modified.json":37}],23:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #48 - email validation too strict",
    schema: {
        type: "string",
        format: "email"
    },
    tests: [
        {
            description: "should pass validation #1",
            data: "zaggino@gmail.com",
            valid: true
        },
        {
            description: "should pass validation #2",
            data: "foo@bar.baz",
            valid: true
        },
        {
            description: "should fail validation #1",
            data: "foobar.baz",
            valid: false
        },
        {
            description: "should fail validation #2",
            data: "foo@bar",
            valid: false
        }
    ]
};

},{}],24:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #49 - pattern validations",
    tests: [
        {
            description: "should pass validation",
            schema: {
                type: "string",
                pattern: "^[0-9]{1}[0-9]{3}(\\s)?[A-Za-z]{2}$"
            },
            data: "0000 aa",
            valid: true
        }
    ]
};

},{}],25:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #53 - Include description (if any) in errors",
    tests: [
        {
            description: "should fail validation and return error description",
            schema: {
                type: "string",
                pattern: "^[0-9]{1}[0-9]{3}(\\s)?[A-Za-z]{2}$",
                description: "Four numbers followed by an optional space and then two letters."
            },
            data: "000 a",
            valid: false,
            after: function (err) {
                expect(err[0].description).toBe("Four numbers followed by an optional space and then two letters.");
            }
        }
    ]
};

},{}],26:[function(require,module,exports){
"use strict";

module.exports = {
    description: "Issue #56 - unresolvable reference due to hash sign",
    tests: [
        {
            description: "should pass validation #1",
            schema: [
                {
                    id: "schemaA#",
                    type: "string"
                },
                {
                    id: "schemaB#",
                    properties: {
                        a: {
                            "$ref": "schemaA#"
                        }
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should pass validation #2",
            schema: [
                {
                    id: "http://virtual/schemaA#",
                    type: "string"
                },
                {
                    id: "http://virtual/schemaB#",
                    properties: {
                        a: {
                            "$ref": "schemaA#"
                        }
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: true
        },
        {
            description: "should pass validation #3",
            schema: [
                {
                    id: "http://virtual/schemaA#",
                    type: "string",
                    "definitions": {
                        "stringDefinition": {
                            "type": "string"
                        }
                    }
                },
                {
                    id: "http://virtual/schemaB#",
                    properties: {
                        a: {
                            "$ref": "schemaA#/definitions/stringDefinition"
                        }
                    }
                }
            ],
            validateSchemaOnly: true,
            valid: true
        }
    ]
};

},{}],27:[function(require,module,exports){
"use strict";

var dataTypeBaseJson = {
    "id": "http://wordnik.github.io/schemas/v1.2/dataTypeBase.json#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "description": "Data type fields (section 4.3.3)",
    "type": "object",
    "oneOf": [
        {
            "required": [
        "type"
      ]
    },
        {
            "required": [
        "$ref"
      ]
    }
  ],
    "properties": {
        "type": {
            "type": "string"
        },
        "$ref": {
            "type": "string"
        },
        "format": {
            "type": "string"
        },
        "defaultValue": {
            "not": {
                "type": [
          "array",
          "object",
          "null"
        ]
            }
        },
        "enum": {
            "type": "array",
            "items": {
                "type": "string"
            },
            "uniqueItems": true,
            "minItems": 1
        },
        "minimum": {
            "type": "string"
        },
        "maximum": {
            "type": "string"
        },
        "items": {
            "$ref": "#/definitions/itemsObject"
        },
        "uniqueItems": {
            "type": "boolean"
        }
    },
    "dependencies": {
        "format": {
            "oneOf": [
                {
                    "properties": {
                        "type": {
                            "enum": [
                "integer"
              ]
                        },
                        "format": {
                            "enum": [
                "int32",
                "int64"
              ]
                        }
                    }
        },
                {
                    "properties": {
                        "type": {
                            "enum": [
                "number"
              ]
                        },
                        "format": {
                            "enum": [
                "float",
                "double"
              ]
                        }
                    }
        },
                {
                    "properties": {
                        "type": {
                            "enum": [
                "string"
              ]
                        },
                        "format": {
                            "enum": [
                "byte",
                "date",
                "date-time"
              ]
                        }
                    }
        }
      ]
        }
    },
    "definitions": {
        "itemsObject": {
            "oneOf": [
                {
                    "type": "object",
                    "required": [
            "$ref"
          ],
                    "properties": {
                        "$ref": {
                            "type": "string"
                        }
                    },
                    "additionalProperties": false
        },
                {
                    "allOf": [
                        {
                            "$ref": "#"
            },
                        {
                            "required": [
                "type"
              ],
                            "properties": {
                                "type": {},
                                "format": {}
                            },
                            "additionalProperties": false
            }
          ]
        }
      ]
        }
    }
};
var modelsObjectJson = {
    "id": "http://wordnik.github.io/schemas/v1.2/modelsObject.json#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "required": [
    "id",
    "properties"
  ],
    "properties": {
        "id": {
            "type": "string"
        },
        "description": {
            "type": "string"
        },
        "properties": {
            "type": "object",
            "additionalProperties": {
                "$ref": "#/definitions/propertyObject"
            }
        },
        "subTypes": {
            "type": "array",
            "items": {
                "type": "string"
            },
            "uniqueItems": true
        },
        "discriminator": {
            "type": "string"
        }
    },
    "dependencies": {
        "subTypes": [
      "discriminator"
    ]
    },
    "definitions": {
        "propertyObject": {
            "allOf": [
                {
                    "not": {
                        "$ref": "#"
                    }
        },
                {
                    "$ref": "dataTypeBase.json#"
        }
      ]
        }
    }
};
var oauth2GrantTypeJson = {
    "id": "http://wordnik.github.io/schemas/v1.2/oauth2GrantType.json#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "minProperties": 1,
    "properties": {
        "implicit": {
            "$ref": "#/definitions/implicit"
        },
        "authorization_code": {
            "$ref": "#/definitions/authorizationCode"
        }
    },
    "definitions": {
        "implicit": {
            "type": "object",
            "required": [
        "loginEndpoint"
      ],
            "properties": {
                "loginEndpoint": {
                    "$ref": "#/definitions/loginEndpoint"
                },
                "tokenName": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        },
        "authorizationCode": {
            "type": "object",
            "required": [
        "tokenEndpoint",
        "tokenRequestEndpoint"
      ],
            "properties": {
                "tokenEndpoint": {
                    "$ref": "#/definitions/tokenEndpoint"
                },
                "tokenRequestEndpoint": {
                    "$ref": "#/definitions/tokenRequestEndpoint"
                }
            },
            "additionalProperties": false
        },
        "loginEndpoint": {
            "type": "object",
            "required": [
        "url"
      ],
            "properties": {
                "url": {
                    "type": "string",
                    "format": "uri"
                }
            },
            "additionalProperties": false
        },
        "tokenEndpoint": {
            "type": "object",
            "required": [
        "url"
      ],
            "properties": {
                "url": {
                    "type": "string",
                    "format": "uri"
                },
                "tokenName": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        },
        "tokenRequestEndpoint": {
            "type": "object",
            "required": [
        "url"
      ],
            "properties": {
                "url": {
                    "type": "string",
                    "format": "uri"
                },
                "clientIdName": {
                    "type": "string"
                },
                "clientSecretName": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        }
    }
};
var authorizationObjectJson = {
    "id": "http://wordnik.github.io/schemas/v1.2/authorizationObject.json#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "additionalProperties": {
        "oneOf": [
            {
                "$ref": "#/definitions/basicAuth"
      },
            {
                "$ref": "#/definitions/apiKey"
      },
            {
                "$ref": "#/definitions/oauth2"
      }
    ]
    },
    "definitions": {
        "basicAuth": {
            "required": [
        "type"
      ],
            "properties": {
                "type": {
                    "enum": [
            "basicAuth"
          ]
                }
            },
            "additionalProperties": false
        },
        "apiKey": {
            "required": [
        "type",
        "passAs",
        "keyname"
      ],
            "properties": {
                "type": {
                    "enum": [
            "apiKey"
          ]
                },
                "passAs": {
                    "enum": [
            "header",
            "query"
          ]
                },
                "keyname": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        },
        "oauth2": {
            "type": "object",
            "required": [
        "type",
        "grantTypes"
      ],
            "properties": {
                "type": {
                    "enum": [
            "oauth2"
          ]
                },
                "scopes": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/oauth2Scope"
                    }
                },
                "grantTypes": {
                    "$ref": "oauth2GrantType.json#"
                }
            },
            "additionalProperties": false
        },
        "oauth2Scope": {
            "type": "object",
            "required": [
        "scope"
      ],
            "properties": {
                "scope": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                }
            },
            "additionalProperties": false
        }
    }
};
var parameterObjectJson = {
    "id": "http://wordnik.github.io/schemas/v1.2/parameterObject.json#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "allOf": [
        {
            "$ref": "dataTypeBase.json#"
    },
        {
            "required": [
        "paramType",
        "name"
      ],
            "properties": {
                "paramType": {
                    "enum": [
            "path",
            "query",
            "body",
            "header",
            "form"
          ]
                },
                "name": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                },
                "required": {
                    "type": "boolean"
                },
                "allowMultiple": {
                    "type": "boolean"
                }
            }
    },
        {
            "description": "type File requires special paramType and consumes",
            "oneOf": [
                {
                    "properties": {
                        "type": {
                            "not": {
                                "enum": [
                  "File"
                ]
                            }
                        }
                    }
        },
                {
                    "properties": {
                        "type": {
                            "enum": [
                "File"
              ]
                        },
                        "paramType": {
                            "enum": [
                "form"
              ]
                        },
                        "consumes": {
                            "enum": [
                "multipart/form-data"
              ]
                        }
                    }
        }
      ]
    }
  ]
};
var operationObjectJson = {
    "id": "http://wordnik.github.io/schemas/v1.2/operationObject.json#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "allOf": [
        {
            "$ref": "dataTypeBase.json#"
    },
        {
            "required": [
        "method",
        "nickname",
        "parameters"
      ],
            "properties": {
                "method": {
                    "enum": [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
          ]
                },
                "summary": {
                    "type": "string",
                    "maxLength": 120
                },
                "notes": {
                    "type": "string"
                },
                "nickname": {
                    "type": "string",
                    "pattern": "^[a-zA-Z0-9_]+$"
                },
                "authorizations": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "array",
                        "items": {
                            "$ref": "authorizationObject.json#/definitions/oauth2Scope"
                        }
                    }
                },
                "parameters": {
                    "type": "array",
                    "items": {
                        "$ref": "parameterObject.json#"
                    }
                },
                "responseMessages": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/responseMessageObject"
                    }
                },
                "produces": {
                    "$ref": "#/definitions/mimeTypeArray"
                },
                "consumes": {
                    "$ref": "#/definitions/mimeTypeArray"
                },
                "deprecated": {
                    "enum": [
            "true",
            "false"
          ]
                }
            }
    }
  ],
    "definitions": {
        "responseMessageObject": {
            "type": "object",
            "required": [
        "code",
        "message"
      ],
            "properties": {
                "code": {
                    "$ref": "#/definitions/rfc2616section10"
                },
                "message": {
                    "type": "string"
                },
                "responseModel": {
                    "type": "string"
                }
            }
        },
        "rfc2616section10": {
            "type": "integer",
            "minimum": 100,
            "maximum": 600,
            "exclusiveMaximum": true
        },
        "mimeTypeArray": {
            "type": "array",
            "items": {
                "type": "string",
                "format": "mime-type"
            }
        }
    }
};
var apiDeclarationJson = {
    "id": "http://wordnik.github.io/schemas/v1.2/apiDeclaration.json#",
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "required": [
    "swaggerVersion",
    "basePath",
    "apis"
  ],
    "properties": {
        "swaggerVersion": {
            "enum": [
        "1.2"
      ]
        },
        "apiVersion": {
            "type": "string"
        },
        "basePath": {
            "type": "string",
            "format": "uri",
            "pattern": "^https?://"
        },
        "resourcePath": {
            "type": "string",
            "format": "uri",
            "pattern": "^/"
        },
        "apis": {
            "type": "array",
            "items": {
                "$ref": "#/definitions/apiObject"
            }
        },
        "models": {
            "type": "object",
            "additionalProperties": {
                "$ref": "modelsObject.json#"
            }
        },
        "produces": {
            "$ref": "#/definitions/mimeTypeArray"
        },
        "consumes": {
            "$ref": "#/definitions/mimeTypeArray"
        },
        "authorizations": {
            "$ref": "authorizationObject.json#"
        }
    },
    "additionalProperties": false,
    "definitions": {
        "apiObject": {
            "type": "object",
            "required": [
        "path",
        "operations"
      ],
            "properties": {
                "path": {
                    "type": "string",
                    "format": "uri-template",
                    "pattern": "^/"
                },
                "description": {
                    "type": "string"
                },
                "operations": {
                    "type": "array",
                    "items": {
                        "$ref": "operationObject.json#"
                    }
                }
            },
            "additionalProperties": false
        },
        "mimeTypeArray": {
            "type": "array",
            "items": {
                "type": "string",
                "format": "mime-type"
            }
        }
    }
};

module.exports = {
    description: "Issue #57 - maximum call stack exceeded error",
    setup: function (validator, Class) {
        Class.registerFormat("mime-type", function () {
            return true;
        });
        Class.registerFormat("uri-template", function () {
            return true;
        });
    },
    tests: [
        {
            description: "should pass validation #1",
            schema: [
                dataTypeBaseJson,
                modelsObjectJson,
                oauth2GrantTypeJson,
                authorizationObjectJson,
                parameterObjectJson,
                operationObjectJson,
                apiDeclarationJson
            ],
            validateSchemaOnly: true,
            valid: true
        }
    ]
};

},{}],28:[function(require,module,exports){
"use strict";

module.exports = {
    description: "compile a schema array and validate against one of the schemas - README sample",
    tests: [
        {
            description: "should validate object successfully",
            schema: [
                {
                    id: "personDetails",
                    type: "object",
                    properties: {
                        firstName: {
                            type: "string"
                        },
                        lastName: {
                            type: "string"
                        }
                    },
                    required: ["firstName", "lastName"]
                },
                {
                    id: "addressDetails",
                    type: "object",
                    properties: {
                        street: {
                            type: "string"
                        },
                        city: {
                            type: "string"
                        }
                    },
                    required: ["street", "city"]
                },
                {
                    id: "personWithAddress",
                    allOf: [
                        {
                            $ref: "personDetails"
                        },
                        {
                            $ref: "addressDetails"
                        }
                    ]
                }
            ],
            schemaIndex: 2,
            data: {
                firstName: "Martin",
                lastName: "Zagora",
                street: "George St",
                city: "Sydney"
            },
            valid: true
        }
    ]
};

},{}],29:[function(require,module,exports){
"use strict";

module.exports = {
    description: "noEmptyArrays - Don't allow empty arrays to validate as arrays",
    options: {
        noEmptyArrays: true
    },
    schema: {
        "type": "array"
    },
    tests: [
        {
            description: "should pass validation when having one item array",
            data: ["item"],
            valid: true
        },
        {
            description: "should fail validation when having empty array",
            data: [],
            valid: false
        }
    ]
};

},{}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
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

},{}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
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

},{}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
module.exports={
  "swagger": 2,
  "info": {
    "version": "1.0.0",
    "title": "Swagger Petstore",
    "contact": {
      "name": "wordnik api team",
      "url": "http://developer.wordnik.com"
    },
    "license": {
      "name": "Creative Commons 4.0 International",
      "url": "http://creativecommons.org/licenses/by/4.0/"
    }
  },
  "host": "http://petstore.swagger.wordnik.com",
  "basePath": "/api",
  "schemes": [
    "http"
  ],
  "paths": {
    "/pets": {
      "get": {
        "tags": [
          "Pet Operations"
        ],
        "summary": "finds pets in the system",
        "responses": {
          "200": {
            "description": "pet response",
            "schema": {
              "type": "array",
              "items": {
                "$ref": "#/models/Pet"
              }
            },
            "headers": [
              {
                "x-expires": {
                  "type": "string"
                }
              }
            ]
          },
          "default": {
            "description": "unexpected error",
            "schema": {
              "$ref": "#/models/Error"
            }
          }
        }
      }
    }
  },
  "schemas": {
    "Pet": {
      "required": [
        "id",
        "name"
      ],
      "properties": {
        "id": {
          "type": "integer",
          "format": "int64"
        },
        "name": {
          "type": "string"
        },
        "tag": {
          "type": "string"
        }
      }
    },
    "Error": {
      "required": [
        "code",
        "message"
      ],
      "properties": {
        "code": {
          "type": "integer",
          "format": "int32"
        },
        "message": {
          "type": "string"
        }
      }
    }
  }
}

},{}],36:[function(require,module,exports){
module.exports={
	"title": "A JSON Schema for Swagger 2.0 API.",
	"$schema": "http://json-schema.org/draft-04/schema#",

	"type": "object",
	"required": [ "swagger", "info", "paths" ],

	"definitions": {
		"info": {
			"type": "object",
			"description": "General information about the API.",
			"required": [ "version", "title" ],
			"additionalProperties": false,
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"version": {
					"type": "string",
					"description": "A semantic version number of the API."
				},
				"title": {
					"type": "string",
					"description": "A unique and precise title of the API."
				},
				"description": {
					"type": "string",
					"description": "A longer description of the API. Should be different from the title."
				},
				"termsOfService": {
					"type": "string",
					"description": "The terms of service for the API."
				},
				"contact": {
					"type": "object",
					"description": "Contact information for the owners of the API.",
					"additionalProperties": false,
					"properties": {
						"name": {
							"type": "string",
							"description": "The identifying name of the contact person/organization."
						},
						"url": {
							"type": "string",
							"description": "The URL pointing to the contact information.",
							"format": "uri"
						},
						"email": {
							"type": "string",
							"description": "The email address of the contact person/organization.",
							"format": "email"
						}
					}
				},
				"license": {
					"type": "object",
					"required": [ "name" ],
					"additionalProperties": false,
					"properties": {
						"name": {
							"type": "string",
							"description": "The name of the license type. It's encouraged to use an OSI compatible license."
						},
						"url": {
							"type": "string",
							"description": "The URL pointing to the license.",
							"format": "uri"
						}
					}
				}
			}
		},
		"example": {
			"type": "object",
			"patternProperties": {
				"^[a-z0-9-]+/[a-z0-9-+]+$": {}
			},
			"additionalProperties": false
		},
		"mimeType": {
			"type": "string",
			"pattern": "^[a-z0-9-]+/[a-z0-9-+]+$",
			"description": "The MIME type of the HTTP message."
		},
		"operation": {
			"type": "object",
			"required": [ "responses" ],
			"additionalProperties": false,
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"tags": {
					"type": "array",
					"items": {
						"type": "string"
					}
				},
				"summary": {
					"type": "string",
					"description": "A brief summary of the operation."
				},
				"description": {
					"type": "string",
					"description": "A longer description of the operation."
				},
				"operationId": {
					"type": "string",
					"description": "A friendly name of the operation"
				},
				"produces": {
					"type": "array",
					"description": "A list of MIME types the API can produce.",
					"additionalItems": false,
					"items": {
						"$ref": "#/definitions/mimeType"
					}
				},
				"parameters": {
					"type": "array",
					"description": "The parameters needed to send a valid API call.",
					"minItems": 1,
					"additionalItems": false,
					"items": {
						"$ref": "#/definitions/parameter"
					}
				},
				"responses": {
					"$ref": "#/definitions/responses"
				},
				"schemes": {
					"type": "array",
					"description": "The transfer protocol of the API.",
					"items": {
						"type": "string",
						"enum": [ "http", "https", "ws", "wss" ]
					}
				}
			}
		},
		"responses": {
			"type": "object",
			"description": "Response objects names can either be any valid HTTP status code or 'default'.",
			"minProperties": 1,
			"additionalProperties": false,
			"patternProperties": {
				"^([0-9]+)$|^(default)$": {
					"$ref": "#/definitions/response"
				},
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			}
		},
		"response": {
			"type": "object",
			"required": [ "description" ],
			"properties": {
				"description": {
					"type": "string"
				},
				"schema": {
					"$ref": "#/definitions/schema"
				},
				"headers": {
					"type": "array",
					"items": {
						"$ref": "#/definitions/schema"
					}
				},
				"examples": {
					"$ref": "#/definitions/example"
				}
			},
			"additionalProperties": false
		},
		"vendorExtension": {
			"description": "Any property starting with x- is valid.",
			"additionalProperties": true,
			"additionalItems": true
		},
		"parameter": {
			"type": "object",
			"required": [ "name", "in"],
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"name": {
					"type": "string",
					"description": "The name of the parameter."
				},
				"in": {
					"type": "string",
					"description": "Determines the location of the parameter.",
					"enum": [ "query", "header", "path", "formData", "body" ],
					"default": "query"
				},
				"description": {
					"type": "string",
					"description": "A brief description of the parameter. This could contain examples of use."
				},
				"required": {
					"type": "boolean",
					"description": "Determines whether or not this parameter is required or optional."
				},
				"schema": {
					"$ref": "#/definitions/schema"
				}
			}
		},
		"schema": {
			"type": "object",
			"description": "A deterministic version of a JSON Schema object.",
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"$ref": { "type": "string" },
				"format": { "type": "string" },
				"title": { "$ref": "http://json-schema.org/draft-04/schema#/properties/title" },
				"description": { "$ref": "http://json-schema.org/draft-04/schema#/properties/description" },
				"default": { "$ref": "http://json-schema.org/draft-04/schema#/properties/default" },
				"multipleOf": { "$ref": "http://json-schema.org/draft-04/schema#/properties/multipleOf" },
				"maximum": { "$ref": "http://json-schema.org/draft-04/schema#/properties/maximum" },
				"exclusiveMaximum": { "$ref": "http://json-schema.org/draft-04/schema#/properties/exclusiveMaximum" },
				"minimum": { "$ref": "http://json-schema.org/draft-04/schema#/properties/minimum" },
				"exclusiveMinimum": { "$ref": "http://json-schema.org/draft-04/schema#/properties/exclusiveMinimum" },
				"maxLength": { "$ref": "http://json-schema.org/draft-04/schema#/definitions/positiveInteger" },
				"minLength": { "$ref": "http://json-schema.org/draft-04/schema#/definitions/positiveIntegerDefault0" },
				"pattern": { "$ref": "http://json-schema.org/draft-04/schema#/properties/pattern" },
				"discriminator": { "type": "string" },
				"xml": { "$ref": "#/definitions/xml"},
				"items": {
					"anyOf": [
						{ "$ref": "#/definitions/schema" },
						{
							"type": "array",
							"minItems": 1,
							"items": { "$ref": "#/definitions/schema" }
						}
					],
					"default": { }
				},
				"maxItems": { "$ref": "http://json-schema.org/draft-04/schema#/definitions/positiveInteger" },
				"minItems": { "$ref": "http://json-schema.org/draft-04/schema#/definitions/positiveIntegerDefault0" },
				"uniqueItems": { "$ref": "http://json-schema.org/draft-04/schema#/properties/uniqueItems" },
				"maxProperties": { "$ref": "http://json-schema.org/draft-04/schema#/definitions/positiveInteger" },
				"minProperties": { "$ref": "http://json-schema.org/draft-04/schema#/definitions/positiveIntegerDefault0" },
				"required": { "$ref": "http://json-schema.org/draft-04/schema#/definitions/stringArray" },
				"definitions": {
					"type": "object",
					"additionalProperties": { "$ref": "#/definitions/schema" },
					"default": { }
				},
				"properties": {
					"type": "object",
					"additionalProperties": { "$ref": "#/definitions/schema" },
					"default": { }
				},
				"enum": { "$ref": "http://json-schema.org/draft-04/schema#/properties/enum" },
				"type": { "$ref": "http://json-schema.org/draft-04/schema#/properties/type" },
				"allOf": {
					"type": "array",
					"minItems": 1,
					"items": { "$ref": "#/definitions/schema" }
				}
			}
		},
		"xml": {
			"properties": {
				"namespace": { "type": "string" },
				"prefix": { "type": "string" },
				"attribute": { "type": "boolean" },
				"wrapped": { "type": "boolean" }
			},
			"additionalProperties": false
		}
	},
	"additionalProperties": false,
	"patternProperties": {
		"^x-": {
			"$ref": "#/definitions/vendorExtension"
		}
	},
	"properties": {
		"swagger": {
			"type": "number",
			"enum": [ 2.0 ],
			"description": "The Swagger version of this document."
		},
		"info": {
			"$ref": "#/definitions/info"
		},
		"host": {
			"type": "string",
			"format": "uri",
			"description": "The fully qualified URI to the host of the API."
		},
		"basePath": {
			"type": "string",
			"pattern": "^/",
			"description": "The base path to the API. Example: '/api'."
		},
		"schemes": {
			"type": "array",
			"description": "The transfer protocol of the API.",
			"items": {
				"type": "string",
				"enum": [ "http", "https", "ws", "wss" ]
			}
		},
		"consumes": {
			"type": "array",
			"description": "A list of MIME types accepted by the API.",
			"items": {
				"$ref": "#/definitions/mimeType"
			}
		},
		"produces": {
			"type": "array",
			"description": "A list of MIME types the API can produce.",
			"items": {
				"$ref": "#/definitions/mimeType"
			}
		},
		"paths": {
			"type": "object",
			"description": "Relative paths to the individual endpoints. They should be relative to the 'basePath'.",

			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},

			"additionalProperties": {
				"type": "object",
				"minProperties": 1,
				"additionalProperties": false,
				"patternProperties": {
					"^x-": {
						"$ref": "#/definitions/vendorExtension"
					}
				},
				"properties": {
					"get": {
						"$ref": "#/definitions/operation"
					},
					"put": {
						"$ref": "#/definitions/operation"
					},
					"post": {
						"$ref": "#/definitions/operation"
					},
					"delete": {
						"$ref": "#/definitions/operation"
					},
					"options": {
						"$ref": "#/definitions/operation"
					},
					"head": {
						"$ref": "#/definitions/operation"
					},
					"patch": {
						"$ref": "#/definitions/operation"
					},
					"parameters": {
						"type": "array",
						"items": {
							"$ref": "#/definitions/parameter"
						}
					}
				}
			}
		},
		"schemas": {
			"type": "object",
			"description": "One or more JSON objects describing the schemas being consumed and produced by the API.",
			"additionalProperties": {
				"$ref": "#/definitions/schema"
			}
		},
		"security": {
			"type": "array"
		}
	}
}

},{}],37:[function(require,module,exports){
module.exports={
	"title": "A JSON Schema for Swagger 2.0 API.",
	"$schema": "http://json-schema.org/draft-04/schema#",

	"type": "object",
	"required": [ "swagger", "info", "paths" ],

	"definitions": {
		"info": {
			"type": "object",
			"description": "General information about the API.",
			"required": [ "version", "title" ],
			"additionalProperties": false,
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"version": {
					"type": "string",
					"description": "A semantic version number of the API."
				},
				"title": {
					"type": "string",
					"description": "A unique and precise title of the API."
				},
				"description": {
					"type": "string",
					"description": "A longer description of the API. Should be different from the title."
				},
				"termsOfService": {
					"type": "string",
					"description": "The terms of service for the API."
				},
				"contact": {
					"type": "object",
					"description": "Contact information for the owners of the API.",
					"additionalProperties": false,
					"properties": {
						"name": {
							"type": "string",
							"description": "The identifying name of the contact person/organization."
						},
						"url": {
							"type": "string",
							"description": "The URL pointing to the contact information.",
							"format": "uri"
						},
						"email": {
							"type": "string",
							"description": "The email address of the contact person/organization.",
							"format": "email"
						}
					}
				},
				"license": {
					"type": "object",
					"required": [ "name" ],
					"additionalProperties": false,
					"properties": {
						"name": {
							"type": "string",
							"description": "The name of the license type. It's encouraged to use an OSI compatible license."
						},
						"url": {
							"type": "string",
							"description": "The URL pointing to the license.",
							"format": "uri"
						}
					}
				}
			}
		},
		"example": {
			"type": "object",
			"patternProperties": {
				"^[a-z0-9-]+/[a-z0-9-+]+$": {}
			},
			"additionalProperties": false
		},
		"mimeType": {
			"type": "string",
			"pattern": "^[a-z0-9-]+/[a-z0-9-+]+$",
			"description": "The MIME type of the HTTP message."
		},
		"operation": {
			"type": "object",
			"required": [ "responses" ],
			"additionalProperties": false,
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"tags": {
					"type": "array",
					"items": {
						"type": "string"
					}
				},
				"summary": {
					"type": "string",
					"description": "A brief summary of the operation."
				},
				"description": {
					"type": "string",
					"description": "A longer description of the operation."
				},
				"operationId": {
					"type": "string",
					"description": "A friendly name of the operation"
				},
				"produces": {
					"type": "array",
					"description": "A list of MIME types the API can produce.",
					"additionalItems": false,
					"items": {
						"$ref": "#/definitions/mimeType"
					}
				},
				"parameters": {
					"type": "array",
					"description": "The parameters needed to send a valid API call.",
					"minItems": 1,
					"additionalItems": false,
					"items": {
						"$ref": "#/definitions/parameter"
					}
				},
				"responses": {
					"$ref": "#/definitions/responses"
				},
				"schemes": {
					"type": "array",
					"description": "The transfer protocol of the API.",
					"items": {
						"type": "string",
						"enum": [ "http", "https", "ws", "wss" ]
					}
				}
			}
		},
		"responses": {
			"type": "object",
			"description": "Response objects names can either be any valid HTTP status code or 'default'.",
			"minProperties": 1,
			"additionalProperties": false,
			"patternProperties": {
				"^([0-9]+)$|^(default)$": {
					"$ref": "#/definitions/response"
				},
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			}
		},
		"response": {
			"type": "object",
			"required": [ "description" ],
			"properties": {
				"description": {
					"type": "string"
				},
				"schema": {
					"$ref": "#/definitions/schema"
				},
				"headers": {
					"type": "array",
					"items": {
						"$ref": "#/definitions/schema"
					}
				},
				"examples": {
					"$ref": "#/definitions/example"
				}
			},
			"additionalProperties": false
		},
		"vendorExtension": {
			"description": "Any property starting with x- is valid.",
			"additionalProperties": true,
			"additionalItems": true
		},
		"parameter": {
			"type": "object",
			"required": [ "name", "in"],
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"name": {
					"type": "string",
					"description": "The name of the parameter."
				},
				"in": {
					"type": "string",
					"description": "Determines the location of the parameter.",
					"enum": [ "query", "header", "path", "formData", "body" ],
					"default": "query"
				},
				"description": {
					"type": "string",
					"description": "A brief description of the parameter. This could contain examples of use."
				},
				"required": {
					"type": "boolean",
					"description": "Determines whether or not this parameter is required or optional."
				},
				"schema": {
					"$ref": "#/definitions/schema"
				}
			}
		},
		"schema": {
			"type": "object",
			"description": "A deterministic version of a JSON Schema object.",
			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},
			"properties": {
				"$ref": { "type": "string" },
				"format": { "type": "string" },
				"title": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/title" },
				"description": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/description" },
				"default": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/default" },
				"multipleOf": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/multipleOf" },
				"maximum": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/maximum" },
				"exclusiveMaximum": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/exclusiveMaximum" },
				"minimum": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/minimum" },
				"exclusiveMinimum": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/exclusiveMinimum" },
				"maxLength": { "$ref": "http://json-schema.orgx/draft-04/schema#/definitions/positiveInteger" },
				"minLength": { "$ref": "http://json-schema.orgx/draft-04/schema#/definitions/positiveIntegerDefault0" },
				"pattern": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/pattern" },
				"discriminator": { "type": "string" },
				"xml": { "$ref": "#/definitions/xml"},
				"items": {
					"anyOf": [
						{ "$ref": "#/definitions/schema" },
						{
							"type": "array",
							"minItems": 1,
							"items": { "$ref": "#/definitions/schema" }
						}
					],
					"default": { }
				},
				"maxItems": { "$ref": "http://json-schema.orgx/draft-04/schema#/definitions/positiveInteger" },
				"minItems": { "$ref": "http://json-schema.orgx/draft-04/schema#/definitions/positiveIntegerDefault0" },
				"uniqueItems": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/uniqueItems" },
				"maxProperties": { "$ref": "http://json-schema.orgx/draft-04/schema#/definitions/positiveInteger" },
				"minProperties": { "$ref": "http://json-schema.orgx/draft-04/schema#/definitions/positiveIntegerDefault0" },
				"required": { "$ref": "http://json-schema.orgx/draft-04/schema#/definitions/stringArray" },
				"definitions": {
					"type": "object",
					"additionalProperties": { "$ref": "#/definitions/schema" },
					"default": { }
				},
				"properties": {
					"type": "object",
					"additionalProperties": { "$ref": "#/definitions/schema" },
					"default": { }
				},
				"enum": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/enum" },
				"type": { "$ref": "http://json-schema.orgx/draft-04/schema#/properties/type" },
				"allOf": {
					"type": "array",
					"minItems": 1,
					"items": { "$ref": "#/definitions/schema" }
				}
			}
		},
		"xml": {
			"properties": {
				"namespace": { "type": "string" },
				"prefix": { "type": "string" },
				"attribute": { "type": "boolean" },
				"wrapped": { "type": "boolean" }
			},
			"additionalProperties": false
		}
	},
	"additionalProperties": false,
	"patternProperties": {
		"^x-": {
			"$ref": "#/definitions/vendorExtension"
		}
	},
	"properties": {
		"swagger": {
			"type": "number",
			"enum": [ 2.0 ],
			"description": "The Swagger version of this document."
		},
		"info": {
			"$ref": "#/definitions/info"
		},
		"host": {
			"type": "string",
			"format": "uri",
			"description": "The fully qualified URI to the host of the API."
		},
		"basePath": {
			"type": "string",
			"pattern": "^/",
			"description": "The base path to the API. Example: '/api'."
		},
		"schemes": {
			"type": "array",
			"description": "The transfer protocol of the API.",
			"items": {
				"type": "string",
				"enum": [ "http", "https", "ws", "wss" ]
			}
		},
		"consumes": {
			"type": "array",
			"description": "A list of MIME types accepted by the API.",
			"items": {
				"$ref": "#/definitions/mimeType"
			}
		},
		"produces": {
			"type": "array",
			"description": "A list of MIME types the API can produce.",
			"items": {
				"$ref": "#/definitions/mimeType"
			}
		},
		"paths": {
			"type": "object",
			"description": "Relative paths to the individual endpoints. They should be relative to the 'basePath'.",

			"patternProperties": {
				"^x-": {
					"$ref": "#/definitions/vendorExtension"
				}
			},

			"additionalProperties": {
				"type": "object",
				"minProperties": 1,
				"additionalProperties": false,
				"patternProperties": {
					"^x-": {
						"$ref": "#/definitions/vendorExtension"
					}
				},
				"properties": {
					"get": {
						"$ref": "#/definitions/operation"
					},
					"put": {
						"$ref": "#/definitions/operation"
					},
					"post": {
						"$ref": "#/definitions/operation"
					},
					"delete": {
						"$ref": "#/definitions/operation"
					},
					"options": {
						"$ref": "#/definitions/operation"
					},
					"head": {
						"$ref": "#/definitions/operation"
					},
					"patch": {
						"$ref": "#/definitions/operation"
					},
					"parameters": {
						"type": "array",
						"items": {
							"$ref": "#/definitions/parameter"
						}
					}
				}
			}
		},
		"schemas": {
			"type": "object",
			"description": "One or more JSON objects describing the schemas being consumed and produced by the API.",
			"additionalProperties": {
				"$ref": "#/definitions/schema"
			}
		},
		"security": {
			"type": "array"
		}
	}
}

},{}],38:[function(require,module,exports){
module.exports={
    "$schema": "http://json-schema.org/draft-04/hyper-schema#",
    "id": "http://json-schema.org/draft-04/hyper-schema#",
    "title": "JSON Hyper-Schema",
    "allOf": [
        {
            "$ref": "http://json-schema.org/draft-04/schema#"
        }
    ],
    "properties": {
        "additionalItems": {
            "anyOf": [
                {
                    "type": "boolean"
                },
                {
                    "$ref": "#"
                }
            ]
        },
        "additionalProperties": {
            "anyOf": [
                {
                    "type": "boolean"
                },
                {
                    "$ref": "#"
                }
            ]
        },
        "dependencies": {
            "additionalProperties": {
                "anyOf": [
                    {
                        "$ref": "#"
                    },
                    {
                        "type": "array"
                    }
                ]
            }
        },
        "items": {
            "anyOf": [
                {
                    "$ref": "#"
                },
                {
                    "$ref": "#/definitions/schemaArray"
                }
            ]
        },
        "definitions": {
            "additionalProperties": {
                "$ref": "#"
            }
        },
        "patternProperties": {
            "additionalProperties": {
                "$ref": "#"
            }
        },
        "properties": {
            "additionalProperties": {
                "$ref": "#"
            }
        },
        "allOf": {
            "$ref": "#/definitions/schemaArray"
        },
        "anyOf": {
            "$ref": "#/definitions/schemaArray"
        },
        "oneOf": {
            "$ref": "#/definitions/schemaArray"
        },
        "not": {
            "$ref": "#"
        },

        "links": {
            "type": "array",
            "items": {
                "$ref": "#/definitions/linkDescription"
            }
        },
        "fragmentResolution": {
            "type": "string"
        },
        "media": {
            "type": "object",
            "properties": {
                "type": {
                    "description": "A media type, as described in RFC 2046",
                    "type": "string"
                },
                "binaryEncoding": {
                    "description": "A content encoding scheme, as described in RFC 2045",
                    "type": "string"
                }
            }
        },
        "pathStart": {
            "description": "Instances' URIs must start with this value for this schema to apply to them",
            "type": "string",
            "format": "uri"
        }
    },
    "definitions": {
        "schemaArray": {
            "type": "array",
            "items": {
                "$ref": "#"
            }
        },
        "linkDescription": {
            "title": "Link Description Object",
            "type": "object",
            "required": [ "href", "rel" ],
            "properties": {
                "href": {
                    "description": "a URI template, as defined by RFC 6570, with the addition of the $, ( and ) characters for pre-processing",
                    "type": "string"
                },
                "rel": {
                    "description": "relation to the target resource of the link",
                    "type": "string"
                },
                "title": {
                    "description": "a title for the link",
                    "type": "string"
                },
                "targetSchema": {
                    "description": "JSON Schema describing the link target",
                    "$ref": "#"
                },
                "mediaType": {
                    "description": "media type (as defined by RFC 2046) describing the link target",
                    "type": "string"
                },
                "method": {
                    "description": "method for requesting the target of the link (e.g. for HTTP this might be \"GET\" or \"DELETE\")",
                    "type": "string"
                },
                "encType": {
                    "description": "The media type in which to submit data along with the request",
                    "type": "string",
                    "default": "application/json"
                },
                "schema": {
                    "description": "Schema describing the data to submit along with the request",
                    "$ref": "#"
                }
            }
        }
    }
}


},{}],39:[function(require,module,exports){
module.exports=require(34)
},{}],40:[function(require,module,exports){
module.exports={
    "type": "integer"
}
},{}],41:[function(require,module,exports){
module.exports=require(40)
},{}],42:[function(require,module,exports){
module.exports={
    "integer": {
        "type": "integer"
    }, 
    "refToInteger": {
        "$ref": "#/integer"
    }
}
},{}],43:[function(require,module,exports){
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

},{}],44:[function(require,module,exports){
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

},{}],45:[function(require,module,exports){
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

},{}],46:[function(require,module,exports){
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

},{}],47:[function(require,module,exports){
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

},{}],48:[function(require,module,exports){
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

},{}],49:[function(require,module,exports){
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

},{}],50:[function(require,module,exports){
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

},{}],51:[function(require,module,exports){
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

},{}],52:[function(require,module,exports){
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

},{}],53:[function(require,module,exports){
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

},{}],54:[function(require,module,exports){
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

},{}],55:[function(require,module,exports){
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

},{}],56:[function(require,module,exports){
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

},{}],57:[function(require,module,exports){
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

},{}],58:[function(require,module,exports){
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

},{}],59:[function(require,module,exports){
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

},{}],60:[function(require,module,exports){
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

},{}],61:[function(require,module,exports){
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

},{}],62:[function(require,module,exports){
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

},{}],63:[function(require,module,exports){
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

},{}],64:[function(require,module,exports){
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

},{}],65:[function(require,module,exports){
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

},{}],66:[function(require,module,exports){
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

},{}],67:[function(require,module,exports){
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

},{}],68:[function(require,module,exports){
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

},{}],69:[function(require,module,exports){
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

},{}],70:[function(require,module,exports){
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

},{}],71:[function(require,module,exports){
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

},{}],72:[function(require,module,exports){
"use strict";

var isBrowser = typeof window !== "undefined";
var ZSchema = require("../../src/ZSchema");
if (!isBrowser) {
    var request = require("request");
}

function validateWithAutomaticDownloads(validator, data, schema, callback) {

    var lastResult;

    function finish() {
        callback(validator.getLastErrors(), lastResult);
    }

    function validate() {

        lastResult = validator.validate(data, schema);

        var missingReferences = validator.getMissingReferences();
        if (missingReferences.length > 0) {
            var finished = 0;
            missingReferences.forEach(function (url) {
                request(url, function (error, response, body) {
                    validator.setRemoteReference(url, JSON.parse(body));
                    finished++;
                    if (finished === missingReferences.length) {
                        validate();
                    }
                });
            });
        } else {
            finish();
        }

    }

    validate();

}

describe("Automatic schema loading", function () {

    it("should download schemas and validate successfully", function (done) {

        if (isBrowser) {
            // skip this test in browsers
            expect(1).toBe(1);
            done();
            return;
        }

        var validator = new ZSchema();
        var schema = { "$ref": "http://json-schema.org/draft-04/schema#" };
        var data = { "minLength": 1 };

        validateWithAutomaticDownloads(validator, data, schema, function (err, valid) {
            expect(valid).toBe(true);
            expect(err).toBe(undefined);
            done();
        });

    });

    it("should download schemas and fail validating", function (done) {

        if (typeof window !== "undefined") {
            // skip this test in browsers
            expect(1).toBe(1);
            done();
            return;
        }

        var validator = new ZSchema();
        var schema = { "$ref": "http://json-schema.org/draft-04/schema#" };
        var data = { "minLength": -1 };

        validateWithAutomaticDownloads(validator, data, schema, function (err, valid) {
            expect(valid).toBe(false);
            expect(err[0].code).toBe("MINIMUM");
            done();
        });

    });

});

},{"../../src/ZSchema":"tqACSv","request":"bQcVMY"}],73:[function(require,module,exports){
"use strict";

var ZSchema = require("../../src/ZSchema");

function setRemoteReferences(validator) {
    validator.setRemoteReference("http://json-schema.org/draft-04/schema",
                                 require("../files/draft-04-schema.json"));
    validator.setRemoteReference("http://localhost:1234/integer.json",
                                 require("../jsonSchemaTestSuite/remotes/integer.json"));
    validator.setRemoteReference("http://localhost:1234/subSchemas.json",
                                 require("../jsonSchemaTestSuite/remotes/subSchemas.json"));
    validator.setRemoteReference("http://localhost:1234/folder/folderInteger.json",
                                 require("../jsonSchemaTestSuite/remotes/folder/folderInteger.json"));
}

describe("Basic", function () {

    it("ZSchema constructor should take one argument - options", function () {
        expect(ZSchema.length).toBe(1);
    });

    it("Work in progress test...", function () {
        var validator = new ZSchema();
        setRemoteReferences(validator);

        var schema = [
                {
                    id: "schemaA",
                    type: "integer"
                },
                {
                    id: "schemaB",
                    type: "string"
                },
                {
                    id: "mainSchema",
                    type: "object",
                    properties: {
                        a: { "$ref": "schemaA" },
                        b: { "$ref": "schemaB" },
                        c: { "enum": ["C"] }
                    }
                }
            ];

        var data = {
            a: 1,
            b: "str",
            c: "C"
        };

        var validSchema = validator.validateSchema(schema);
        expect(validSchema).toBe(true);

        if (!validSchema) {
            console.log(validator.getLastErrors());
            return;
        }

        var valid = validator.validate(data, schema[2]);
        expect(valid).toBe(true);

        if (!valid) {
            console.log(validator.getLastErrors());
            return;
        }

    });

});

},{"../../src/ZSchema":"tqACSv","../files/draft-04-schema.json":39,"../jsonSchemaTestSuite/remotes/folder/folderInteger.json":40,"../jsonSchemaTestSuite/remotes/integer.json":41,"../jsonSchemaTestSuite/remotes/subSchemas.json":42}],74:[function(require,module,exports){
"use strict";

var ZSchema = require("../../src/ZSchema");

function setRemoteReferences(validator) {
    validator.setRemoteReference("http://json-schema.org/draft-04/schema",
                                 require("../files/draft-04-schema.json"));
    validator.setRemoteReference("http://localhost:1234/integer.json",
                                 require("../jsonSchemaTestSuite/remotes/integer.json"));
    validator.setRemoteReference("http://localhost:1234/subSchemas.json",
                                 require("../jsonSchemaTestSuite/remotes/subSchemas.json"));
    validator.setRemoteReference("http://localhost:1234/folder/folderInteger.json",
                                 require("../jsonSchemaTestSuite/remotes/folder/folderInteger.json"));
}

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
                    setRemoteReferences(validator);

                    var valid = validator.validate(test.data, testDefinition.schema);
                    expect(valid).toBe(test.valid);

                    if (valid !== test.valid) {
                        if (!valid) {
                            var errors = validator.getLastErrors();
                            expect(errors).toBe(null);
                        }
                    }

                });

            });

        });

    });

});

},{"../../src/ZSchema":"tqACSv","../files/draft-04-schema.json":39,"../jsonSchemaTestSuite/remotes/folder/folderInteger.json":40,"../jsonSchemaTestSuite/remotes/integer.json":41,"../jsonSchemaTestSuite/remotes/subSchemas.json":42,"../jsonSchemaTestSuite/tests/draft4/additionalItems.json":43,"../jsonSchemaTestSuite/tests/draft4/additionalProperties.json":44,"../jsonSchemaTestSuite/tests/draft4/allOf.json":45,"../jsonSchemaTestSuite/tests/draft4/anyOf.json":46,"../jsonSchemaTestSuite/tests/draft4/definitions.json":47,"../jsonSchemaTestSuite/tests/draft4/dependencies.json":48,"../jsonSchemaTestSuite/tests/draft4/enum.json":49,"../jsonSchemaTestSuite/tests/draft4/items.json":50,"../jsonSchemaTestSuite/tests/draft4/maxItems.json":51,"../jsonSchemaTestSuite/tests/draft4/maxLength.json":52,"../jsonSchemaTestSuite/tests/draft4/maxProperties.json":53,"../jsonSchemaTestSuite/tests/draft4/maximum.json":54,"../jsonSchemaTestSuite/tests/draft4/minItems.json":55,"../jsonSchemaTestSuite/tests/draft4/minLength.json":56,"../jsonSchemaTestSuite/tests/draft4/minProperties.json":57,"../jsonSchemaTestSuite/tests/draft4/minimum.json":58,"../jsonSchemaTestSuite/tests/draft4/multipleOf.json":59,"../jsonSchemaTestSuite/tests/draft4/not.json":60,"../jsonSchemaTestSuite/tests/draft4/oneOf.json":61,"../jsonSchemaTestSuite/tests/draft4/optional/bignum.json":62,"../jsonSchemaTestSuite/tests/draft4/optional/format.json":63,"../jsonSchemaTestSuite/tests/draft4/pattern.json":64,"../jsonSchemaTestSuite/tests/draft4/patternProperties.json":65,"../jsonSchemaTestSuite/tests/draft4/properties.json":66,"../jsonSchemaTestSuite/tests/draft4/ref.json":67,"../jsonSchemaTestSuite/tests/draft4/refRemote.json":68,"../jsonSchemaTestSuite/tests/draft4/required.json":69,"../jsonSchemaTestSuite/tests/draft4/type.json":70,"../jsonSchemaTestSuite/tests/draft4/uniqueItems.json":71}],75:[function(require,module,exports){
/*jshint -W030 */

"use strict";

var ZSchema = require("../../src/ZSchema");

var testSuiteFiles = [
    require("../ZSchemaTestSuite/CustomFormats.js"),
    require("../ZSchemaTestSuite/CustomFormatsAsync.js"),
    require("../ZSchemaTestSuite/ForceAdditional.js"),
    require("../ZSchemaTestSuite/ForceItems.js"),
    require("../ZSchemaTestSuite/ForceMaxLength.js"),
    require("../ZSchemaTestSuite/ForceProperties.js"),
    require("../ZSchemaTestSuite/IgnoreUnresolvableReferences.js"),
    require("../ZSchemaTestSuite/AssumeAdditional.js"),
    require("../ZSchemaTestSuite/NoEmptyArrays.js"),
    require("../ZSchemaTestSuite/NoEmptyStrings.js"),
    require("../ZSchemaTestSuite/NoTypeless.js"),
    require("../ZSchemaTestSuite/NoExtraKeywords.js"),
    require("../ZSchemaTestSuite/StrictUris.js"),
    require("../ZSchemaTestSuite/MultipleSchemas.js"),
    require("../ZSchemaTestSuite/ErrorPathAsArray.js"),
    // issues
    require("../ZSchemaTestSuite/Issue12.js"),
    require("../ZSchemaTestSuite/Issue13.js"),
    require("../ZSchemaTestSuite/Issue16.js"),
    require("../ZSchemaTestSuite/Issue22.js"),
    require("../ZSchemaTestSuite/Issue25.js"),
    require("../ZSchemaTestSuite/Issue26.js"),
    require("../ZSchemaTestSuite/Issue37.js"),
    require("../ZSchemaTestSuite/Issue40.js"),
    require("../ZSchemaTestSuite/Issue41.js"),
    require("../ZSchemaTestSuite/Issue43.js"),
    require("../ZSchemaTestSuite/Issue44.js"),
    require("../ZSchemaTestSuite/Issue45.js"),
    require("../ZSchemaTestSuite/Issue47.js"),
    require("../ZSchemaTestSuite/Issue48.js"),
    require("../ZSchemaTestSuite/Issue49.js"),
    require("../ZSchemaTestSuite/Issue53.js"),
    require("../ZSchemaTestSuite/Issue56.js"),
    require("../ZSchemaTestSuite/Issue57.js"),
    undefined
];

describe("ZSchemaTestSuite", function () {

    var idx = testSuiteFiles.length;
    while (idx--) {
        if (testSuiteFiles[idx] == null) {
            testSuiteFiles.splice(idx, 1);
        }
    }

    it("should contain 33 files", function () {
        expect(testSuiteFiles.length).toBe(33);
    });

    testSuiteFiles.forEach(function (testSuite) {

        testSuite.tests.forEach(function (test) {

            var data = test.data;
            if (typeof data === "undefined") {
                data = testSuite.data;
            }

            var async               = test.async              || testSuite.async        || false,
                options             = test.options            || testSuite.options      || undefined,
                setup               = test.setup              || testSuite.setup,
                schema              = test.schema             || testSuite.schema,
                schemaIndex         = test.schemaIndex        || testSuite.schemaIndex  || 0,
                after               = test.after              || testSuite.after,
                validateSchemaOnly  = test.validateSchemaOnly || testSuite.validateSchemaOnly;

            !async && it(testSuite.description + ", " + test.description, function () {

                var validator = new ZSchema(options);
                validator.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));
                validator.setRemoteReference("http://json-schema.org/draft-04/hyper-schema", require("../files/draft-04-hyper-schema.json"));
                if (setup) { setup(validator, ZSchema); }

                var valid = validator.validateSchema(schema);

                if (valid && !validateSchemaOnly) {
                    if (Array.isArray(schema)) {
                        schema = schema[schemaIndex];
                    }
                    valid = validator.validate(data, schema);
                }

                var err = validator.getLastErrors();

                expect(typeof valid).toBe("boolean", "returned response is not a boolean");
                expect(valid).toBe(test.valid, "test result doesn't match expected test result");
                if (test.valid === true) {
                    expect(err).toBe(undefined, "errors are not undefined when test is valid");
                }
                if (after) {
                    after(err, valid, data);
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
                        after(err, valid, data);
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

},{"../../src/ZSchema":"tqACSv","../ZSchemaTestSuite/AssumeAdditional.js":1,"../ZSchemaTestSuite/CustomFormats.js":2,"../ZSchemaTestSuite/CustomFormatsAsync.js":3,"../ZSchemaTestSuite/ErrorPathAsArray.js":4,"../ZSchemaTestSuite/ForceAdditional.js":5,"../ZSchemaTestSuite/ForceItems.js":6,"../ZSchemaTestSuite/ForceMaxLength.js":7,"../ZSchemaTestSuite/ForceProperties.js":8,"../ZSchemaTestSuite/IgnoreUnresolvableReferences.js":9,"../ZSchemaTestSuite/Issue12.js":10,"../ZSchemaTestSuite/Issue13.js":11,"../ZSchemaTestSuite/Issue16.js":12,"../ZSchemaTestSuite/Issue22.js":13,"../ZSchemaTestSuite/Issue25.js":14,"../ZSchemaTestSuite/Issue26.js":15,"../ZSchemaTestSuite/Issue37.js":16,"../ZSchemaTestSuite/Issue40.js":17,"../ZSchemaTestSuite/Issue41.js":18,"../ZSchemaTestSuite/Issue43.js":19,"../ZSchemaTestSuite/Issue44.js":20,"../ZSchemaTestSuite/Issue45.js":21,"../ZSchemaTestSuite/Issue47.js":22,"../ZSchemaTestSuite/Issue48.js":23,"../ZSchemaTestSuite/Issue49.js":24,"../ZSchemaTestSuite/Issue53.js":25,"../ZSchemaTestSuite/Issue56.js":26,"../ZSchemaTestSuite/Issue57.js":27,"../ZSchemaTestSuite/MultipleSchemas.js":28,"../ZSchemaTestSuite/NoEmptyArrays.js":29,"../ZSchemaTestSuite/NoEmptyStrings.js":30,"../ZSchemaTestSuite/NoExtraKeywords.js":31,"../ZSchemaTestSuite/NoTypeless.js":32,"../ZSchemaTestSuite/StrictUris.js":33,"../files/draft-04-hyper-schema.json":38,"../files/draft-04-schema.json":39}]},{},[72,73,74,75]);
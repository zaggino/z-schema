"use strict";

module.exports = {
    description: "includeErrors - Validate only against specified errors",
    options: {
        breakOnFirstError: false,
        assumeAdditional: true
    },
    tests: [
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "number"
                    }
                }
            },
            data: {
                hello: "world"
            },
            validateOptions: { 
                includeErrors: ["INVALID_TYPE"]
            },
            description: "should fail validation when the specified error is present",
            valid: false
        },
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "number"
                    }
                }
            },
            data: {
                hello: "world"
            },
            validateOptions: { 
                includeErrors: ["OBJECT_ADDITIONAL_PROPERTIES"]
            },
            description: "should pass validation when the specified error is not present",
            valid: true
        },
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "number"
                    }
                }
            },
            data: {
                hello: "world",
                extra: "extra"
            },
            validateOptions: { 
                includeErrors: ["INVALID_TYPE"]
            },
            description: "should fail validation when the specified error is present only for that error",
            valid: false,
            after: function(errs) {
                expect(errs.length).toBe(1);
                expect(errs[0].code).toBe("INVALID_TYPE");
            }
        },
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "number"
                    }
                }
            },
            data: {
                hello: "world",
                extra: "extra"
            },
            description: "should fail validation for all errors when no `includeErrors` array is provided.",
            valid: false,
            after: function(errs) {
                expect(errs.length).toBe(2);
            }
        },
        {
            schema: {
                "type": "object",
                "properties": {
                    "hello": {
                        "type": "number"
                    }
                }
            },
            data: {
                hello: "world",
                extra: "extra"
            },
            validateOptions: { 
                includeErrors: []
            },
            description: "should fail validation for all errors when empty array is provided.",
            valid: false,
            after: function(errs) {
                expect(errs.length).toBe(2);
            }
        }
    ]
};

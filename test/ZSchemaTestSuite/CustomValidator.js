"use strict";

//Implement new 'shouldFail' keyword
function customValidatorFn(report, schema, json) {
    if (schema.shouldFail === true) {
        report.addCustomError("SHOULD_FAIL", "Forced fail", [], null, schema.description);
    }
}

module.exports = {
    description: "customValidator - Function to be called on every schema",
    options: {
        customValidator: customValidatorFn
    },
    schema: {
        "type": "object",
        "properties": {
            "a": {
              "type": "integer"
            },
            "b": {
              shouldFail: false
            }
        },
        "additionalProperties": {
          shouldFail: true
        }
    },
    tests: [
        {
            description: "should pass custom validation",
            data: {
                a: 0,
                b: null
            },
            valid: true
        },
        {
            description: "should fail on standard error",
            data: {
                a: "incorrect type",
                b: null
            },
            valid: false,
            after: function (err) {
                expect(err[0].code).toBe("INVALID_TYPE");
            }
        },
        {
            description: "should fail on custom error",
            data: {
                c: null
            },
            valid: false,
            after: function (err) {
                expect(err[0].code).toBe("SHOULD_FAIL");
                expect(err[0].message).toBe("Forced fail");
            }
        }
    ]
};

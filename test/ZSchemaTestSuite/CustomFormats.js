"use strict";

module.exports = {
    description: "Custom formats support",
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

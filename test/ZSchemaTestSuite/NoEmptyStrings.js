"use strict";

module.exports = {
    description: "Force additional properties/items in schemas",
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

"use strict";

module.exports = {
    description: "Issue #250 - Floating point precision is lost",
    tests: [
        {
            description: "should pass the multipleOf",
            schema: {
              "properties": {
                "number": {
                  "multipleOf": 0.01
                }
              }
            },
            data: {
              "number": 20.29
            },
            valid: true
        }
    ]
};

"use strict";

module.exports = {
    description: "Report error paths with integer array indices",
    options: {
        reportPathAsArray: true
    },
    tests: [
        {
            description: "should fail validation and error path should contain integer array index",
            schema: {
                "type": "object",
                "properties": {
                    "list": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    }
                }
            },
            data: {
                "list": [
                    123
                ]
            },
            valid: false,
            validateSchemaOnly: false,
            after: function (err) {
                expect(err[0].path).toEqual(["list", 0]);
            }
        }
    ]
};

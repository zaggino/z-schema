"use strict";

module.exports = {
    description: "Issue #151 - minProperties for object type doesn't work",
    tests: [
        {
            description: "should fail",
            schema: {
                "type": "object",
                "properties": {
                    "props": {
                        "type": "object",
                        "minProperties": 1
                    }
                }
            },
            data: {
                "props": {}
            },
            valid: false,
            after: function (err) {
                expect(err[0].code).toBe("OBJECT_PROPERTIES_MINIMUM");
            }
        }
    ]
};

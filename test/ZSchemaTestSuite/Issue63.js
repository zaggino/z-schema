"use strict";

module.exports = {
    description: "Issue #63 - unresolvable reference due to hash sign in id",
    tests: [
        {
            description: "should pass validation #1",
            schema: {
                "properties": {
                    "statementpost": {
                        "id": "#statementpost",
                        "type": [
                            "object"
                        ]
                    },
                    "statement": {
                        "id": "#statement",
                        "type": "object",
                    }
                }
            },
            validateSchemaOnly: true,
            valid: true
        }
    ]
};

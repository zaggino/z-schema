"use strict";

module.exports = {
    description: "Issue #142 - assumeAdditional complains about $ref",
    tests: [
        {
            description: "should pass",
            options: {
                assumeAdditional: ["$ref"]
            },
            schema: "http://json-schema.org/draft-04/schema",
            data: { $ref: "#" },
            valid: true
        }
    ]
};

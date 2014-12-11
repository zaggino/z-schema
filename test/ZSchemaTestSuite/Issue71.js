"use strict";

module.exports = {
    description: "Issue #71 - additionalProperties problem",
    tests: [
        {
            description: "should have two errors",

            schema: {
                type: 'object',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    foo: {
                        type: 'object',
                        minProperties: 1
                    }
                }
            },

            data: { foo: {}, bar: 1 },

            valid: false,

            after: function(errors) {
                expect(errors.length).toBe(2);
            }
        },

        {
            description: "should have two errors",

            schema: {
                type: 'object',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    foo: {
                        type: 'object',
                        minProperties: 1,
                        additionalProperties: false,
                        properties: {
                            foo: {}
                        }
                    }
                }
            },

            data: { foo: {}, bar: 1 },

            valid: false,

            after: function(errors) {
                expect(errors.length).toBe(2);
            }
        }
    ]
};

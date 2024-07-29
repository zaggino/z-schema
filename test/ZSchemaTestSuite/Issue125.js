"use strict";

var REF_NAME = "int.json";

module.exports = {
    description: "Issue #125 - Why process format if type validation fails",
    setup: function (validator, Class) {
      Class.registerFormat("test", function (item) {
          return typeof item === 'string';
      });
    },
    tests: [
        {
            description: "should fail with one error",
            schema: {
              type: "object",
              properties: {
                callbacks: {
                  type: "array",
                  items: {
                    type: "string",
                    format: "test",
                  },
                },
              },
            },
            data: {
              callbacks: [true],
            },
            valid: false,
            after: function (err, valid, data, validator) {
              expect(err.length).toBe(1);
              expect(err[0].code).toBe("INVALID_TYPE");
            }
        }
    ]
};

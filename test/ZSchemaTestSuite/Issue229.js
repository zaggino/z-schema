"use strict";

module.exports = {
    description: "Issue #229 - Paths in errors are incorrect due to Issue #209 fix",
    tests: [
        {
            description: "should fail with correct error path",
            schema: {
              "allOf": [
                {
                  "properties": {
                    "setup": {
                      "description": "Account Research Setup",
                      "properties": {
                        "excessiveCredit": {
                          "properties": {
                            "negativeBatch": {
                              "type": "number",
                              "minimum": 0,
                              "maximum": 999999999.99,
                              "title": "Negative Batch $"
                            },
                            "amountOfCreditsInBatch": {
                              "type": "number",
                              "minimum": 0,
                              "maximum": 999999999.99,
                              "title": "Amount of Credits in a Batch $"
                            },
                            "numberOfCreditsInBatch": {
                              "type": "number",
                              "minimum": 1,
                              "maximum": 999,
                              "title": "Number of Credits in a Batch"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              ]
            },
            data: {
              "setup": {
                "excessiveCredit": {
                  "amountOfCreditsInBatch": -15000.21,
                  "negativeBatch": 25001,
                  "numberOfCreditsInBatch": 155
                }
              }
            },
            valid: false,
            after: function (err) {
              expect(err.length).toBe(1);
              expect(err[0].code).toBe('MINIMUM');
              expect(err[0].path).toBe('#/setup/excessiveCredit/amountOfCreditsInBatch');
            }
        }
    ]
};

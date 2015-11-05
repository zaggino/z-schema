module.exports = {
    description: "Issue #143 - successfully fail validation for incorrect schema input to validateSchema method",
    tests: [
        {
            description: "should fail",
            schema: {
                metaSchema: {
                    name: "department",
                    type: "record",
                    version: 1,
                    jsonSchema: "v4",
                    base: "entity"
                },
                schema: {
                    id: "department",
                    type: "object",
                    properties: {
                        recType: {
                            type: "string"
                        }
                    },
                    required: ["recType"]
                }
            },
            valid: false,
            after: function (err) {
                expect(err).toBeTruthy();

            }
        }
    ]
};

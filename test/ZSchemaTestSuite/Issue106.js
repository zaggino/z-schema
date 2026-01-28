

export default {
    description: "Issue #106 - validateSchema method returns true if you pass an empty array",
    tests: [
        {
            description: "should fail with an error",
            schema: [],
            validateSchemaOnly: true,
            failWithException: true
        }
    ]
};

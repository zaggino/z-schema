module.exports = {
    description: "Issue #139 - add schema id if present to erro message via addError method",
    tests: [
        {
            description: "should fail",
            options: {
                strictMode: true
            },
            schema: {
                id: 'dummy',
                type: 'object',
                description: 'This is a dummy schema',
                properties: {
                    recType: {
                        type: 'string'
                    },
                    startDate: {
                        type: ['object', 'string'],
                        format: 'date'
                    },
                    endDate: {
                        type: ['object', 'string'],
                        format: 'date'
                    },
                    noteList: {
                        type: 'array',
                        items: {
                            $ref: 'note'
                        }
                    },
                    isBlocked: {
                        type: 'boolean'
                    },
                    roleA: {
                        $ref: 'dbRef'
                    },
                    roleB: {
                        $ref: 'dbRef'
                    },
                    recProps: {
                        type: 'object'
                    }

              },
              additionalProperties: false,
              required: ['recType','roleA','roleB']
            },
            valid: false,
            after: function (err) {
                expect(err.length).toBe(4);
                if (err.length === 4) {
                    expect(err[0].code).toBe("UNRESOLVABLE_REFERENCE");
                    expect(err[0].id).toBe("dummy");

                }
            }
        }
    ]
};

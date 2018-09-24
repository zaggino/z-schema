"use strict";

module.exports = {
    description: "Issue #222 - Object.keys() does not guarantee order",
    tests: [
        {
            description: "should pass",
            schema: {
              "type":"object",
              "oneOf": [
                {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "string"
                    },
                    "libelle": {
                      "type": "string"
                    }
                  },
                  "enum": [
                    {
                      "code": "null",
                      "libelle": "null"
                    }
                  ]
                },
                {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "string"
                    },
                    "libelle": {
                      "type": "string"
                    }
                  },
                  "enum": [
                    {
                      "code": "0",
                      "libelle": "Choice 1"
                    }
                  ]
                },
                {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "string"
                    },
                    "libelle": {
                      "type": "string"
                    }
                  },
                  "enum": [
                    {
                      "code": "1",
                      "libelle": "Choice 2"
                    }
                  ]
                },
                {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "string"
                    },
                    "libelle": {
                      "type": "string"
                    }
                  },
                  "enum": [
                    {
                      "code": "2",
                      "libelle": "Choice 3"
                    }
                  ]
                }
              ]
            },
            data: {
                "code": "2",
                "libelle": "Choice 3"
            },
            valid: true
        }
    ]
};

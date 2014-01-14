/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/22", function () {

    var objectToValidate = {
        "is_and": false,
        "filters": [
            {
                "is_and": false,
                "filters": [
                    {
                        "is_and": true,
                        "filters": [
                            {
                                "is_and": true,
                                "filters": [
                                    {
                                        "is_and": true,
                                        "filters": [
                                            {
                                                "is_and": true,
                                                "filters": [
                                                    {
                                                        "text": "ABC",
                                                        "is_last": true,
                                                        "filters": []
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };

    var schemaForObject = {
        type: "object",
        additionalProperties: false,
        properties: {
            "is_and": { type: "boolean" },
            "filters": {
                type: "array",
                additionalItems: false,
                items: {
                    oneOf: [
                        { $ref: "#" },
                        { $ref: "#/definitions/last" }
                    ]
                }
            }
        },
        definitions: {
            "last": {
                type: "object",
                additionalProperties: false,
                properties: {
                    "text": { type: "string" },
                    "is_last": { type: "boolean" },
                    "filters": { type: "array", additionalItems: false }
                }
            }
        }
    };

    it("should validate by schema successfully", function (done) {
        ZSchema.validate(objectToValidate, schemaForObject, function (err, report) {
            try {
                assert.isNull(err);
                assert.isTrue(report.valid);
            } catch (e) {
                return done(e);
            }
            done();
        });
    });

});





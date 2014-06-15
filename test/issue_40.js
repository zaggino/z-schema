/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/40", function () {

    function getJson() {
        return {
            "is_start": true,
            "hierarchy": {
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
                                                                "is_and": true,
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
            }};
    }

    function getSchema() {
        return {
            "$schema": "http://json-schema.org/draft-04/schema#",
            "title": "Product set",
            "is_start": "boolean",
            "hierarchy": {
                "$ref": "#/definitions/recursion"
            },
            "definitions": {
                "recursion": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "is_and": {
                            "type": "boolean"
                        },
                        "filters": {
                            "type": "array",
                            "additionalItems": false,
                            "items": {
                                "$ref": "#/definitions/recursion"
                            }
                        }
                    }
                }
            }
        };
    }

    it("should allow validation by uri", function (done) {
        ZSchema.validate(getJson(), getSchema(), function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });

});

/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/12", function () {

    var validSchema = {
        "id": "http://my.site/myschema#",
        "$ref": "#/definitions/schema2",
        "definitions": {
            "schema1": {
                "id": "schema1",
                "type": "integer"
            },
            "schema2": {
                "type": "array",
                "items": {
                    "$ref": "schema1"
                }
            }
        }
    };

    var schemaA = {
        // $schema: "http://json-schema.org/draft-04/schema#", `schemaA` is not be a valid id - according to $schema it has to be uri
        id: "schemaA",
        type: "object",
        properties: {
            a: {
                type: "integer"
            },
            b: {
                type: "string"
            },
            c: {
                $ref: "schemaB"
            }
        },
        required: ["a"]
    };

    /*
    var schemaB = {
        $schema: "http://json-schema.org/draft-04/schema#",
        id: "schemaB",
        type: "integer"
    };
    */

    it("should successfully validate with validSchema from http://json-schema.org/latest/json-schema-core.html#rfc.section.7.2.3", function (done) {
        var validator = new ZSchema();
        validator.validate([1, 2, 3], validSchema).then(function (report) {
            assert.isTrue(report.valid);
            done();
        }).fail(function (err) {
            console.error(err);
            assert.isTrue(false);
            done();
        });
    });

    it("should fail validation with validSchema from http://json-schema.org/latest/json-schema-core.html#rfc.section.7.2.3", function (done) {
        var validator = new ZSchema();
        validator.validate(["1", null, 3], validSchema).then(function (report) {
            assert.isFalse(report.valid);
            done();
        }).fail(function () {
            assert.isTrue(true);
            done();
        });
    });

    it("schemaA should fail compilation on its own", function (done) {
        var validator = new ZSchema();
        validator.compileSchema(schemaA).then(function (report) {
            assert.isFalse(report.valid);
            done();
        }).fail(function (err) {
            assert.isTrue(err.errors.length === 1);
            assert.isTrue(err.errors[0].code === "UNRESOLVABLE_REFERENCE");
            done();
        }).fail(function (e) {
            done(e);
        });
    });

});

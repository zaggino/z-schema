/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/26", function () {

    var schema = {
        "oneOf": [
            { $ref: "#/definitions/str" },
            { $ref: "#/definitions/num" }
        ],
        "definitions": {
            "str": {
                "type": "string"
            },
            "num": {
                "type": "number"
            }
        }
    };

    it("should validate by schema successfully", function (done) {
        ZSchema.validate("string", schema, function (err, report) {
            try {
                assert.isNull(err);
                assert.isTrue(report.valid);
            } catch (e) {
                return done(e);
            }
            done();
        });
    });

    it("should validate with noTypeless successfully", function (done) {
        var validator = new ZSchema({ noTypeless: true });
        validator.validate("string", schema, function (err, report) {
            try {
                assert.isNull(err);
                assert.isTrue(report.valid);
            } catch (e) {
                return done(e);
            }
            done();
        });
    });

    it("should fail validation with noTypeless", function (done) {
        var validator = new ZSchema({ noTypeless: true });
        validator.validate(true, schema, function (err) {
            try {
                assert.ok(err);
            } catch (e) {
                return done(e);
            }
            done();
        });
    });

});

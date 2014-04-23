/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/36", function () {

    function getSchema() {
        return {
            type: "object",
            properties: {
                "prop1": { type: "boolean" },
                "prop2": { type: "boolean" }
            },
            anyOf: [
                {
                    required: ["prop1"]
                },
                {
                    required: ["prop2"]
                }
            ]
        };
    }

    it("should validate by schema successfully", function (done) {
        ZSchema.validate({prop1: true}, getSchema(), function (err, report) {
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
        validator.validate({prop1: true}, getSchema(), function (err, report) {
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

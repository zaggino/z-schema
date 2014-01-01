/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/21", function () {

    it("should validate schema successfully", function (done) {
        var schema = {
            "$schema": "http://json-schema.org/schema#",
            "properties": { "text": { "type": "string" } },
            "type": "object"
        };
        var json = { "text": "o"};
        ZSchema.validate(json, schema, function (err, report) {
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

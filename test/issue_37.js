/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/37", function () {

    var fileContent = "{ \"type\": \"array\" }";
    var uri = "http://localhost:1234/array_schema.json";

    it("should allow validation by uri", function (done) {
        ZSchema.setRemoteReference(uri, fileContent);
        ZSchema.validate([], uri, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });

    it("should allow validation by uri - failcase", function (done) {
        ZSchema.setRemoteReference(uri, fileContent);
        ZSchema.validate("invalid", uri, function (err) {
            assert.ok(err);
            done();
        });
    });

});

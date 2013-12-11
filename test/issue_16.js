/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;
var fs = require("fs");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/hyper-schema", fs.readFileSync(__dirname + "/remotes/hyper-schema.json", "utf8"));

describe("https://github.com/zaggino/z-schema/issues/16", function () {

    it("should pass when $schema is not present", function (done) {
        var schema = {};
        new ZSchema().validateSchema(schema).then(function (report) {
            assert.isTrue(report.valid);
            done();
        }).fail(function (err) {
            assert.isUndefined(err);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should pass when url in $schema is reachable", function (done) {
        var schema = {
            $schema: "http://json-schema.org/draft-04/hyper-schema#"
        };
        new ZSchema().validateSchema(schema).then(function (report) {
            assert.isTrue(report.valid);
            done();
        }).fail(function (err) {
            assert.isUndefined(err);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should fail when url in $schema is not reachable", function (done) {
        var schema = {
            $schema: "http://localhost:12345/schema"
        };
        new ZSchema().validateSchema(schema).then(function (report) {
            assert.isFalse(report.valid);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should not raise any warnings because links are defined in hyper-schema", function (done) {
        var schema = {
            $schema: "http://json-schema.org/draft-04/hyper-schema#",
            links: []
        };
        new ZSchema().validateSchema(schema).fail(function (err) {
            done(err);
        }).then(function (report) {
            assert.isTrue(report.valid);
            assert.isTrue(report.warnings.length === 0);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should fail because links is expected to be an array", function (done) {
        this.timeout(60 * 60 * 1000);
        var schema = {
            $schema: "http://json-schema.org/draft-04/hyper-schema#",
            links: "not an array"
        };
        new ZSchema().validateSchema(schema).fail(function (report) {
            assert.isTrue(report.errors.length > 0);
            done();
        }).then(function (report) {
            assert.isFalse(report.valid, "Report should not be valid");
            done();
        }).fail(function (e) {
            done(e);
        });
    });

});

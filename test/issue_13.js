/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/13", function () {

    var schemaA = {id: "schemaA", type: "integer"};
    var schemaB = {id: "schemaB", type: "string"};
    var mainSchema = {
        id: "mainSchema",
        type: "object",
        properties: {
            a: {"$ref": "schemaA"},
            b: {"$ref": "schemaB"},
            c: {"enum": ["C"]}
        }
    };

    it("should add compilation marks to a schema if it passed compilation", function (done) {
        var schema = {id: "schemaA", type: "integer"};
        var validator = new ZSchema();
        validator.compileSchema(schema).then(function () {
            assert.isTrue(schema.__$compiled);
            done();
        }).fail(function (err) {
            assert.isUndefined(err);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should erase compilation marks from schema if it failed to compile", function (done) {
        var schema = { $ref: "woohooo" };
        var validator = new ZSchema();
        validator.compileSchema(schema).then(function () {
            assert.isTrue(false);
            done();
        }).fail(function () {
            assert.isUndefined(schema.__$compiled);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should add validation marks to a schema if it passed validation", function (done) {
        var schema = {id: "schemaA", type: "integer"};
        var validator = new ZSchema();
        validator.validateSchema(schema).then(function () {
            assert.isTrue(schema.__$validated);
            done();
        }).fail(function (err) {
            assert.isUndefined(err);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should erase validation marks from schema if it failed to validate", function (done) {
        var schema = {id: "schemaA", type: "woohooo"};
        var validator = new ZSchema();
        validator.validateSchema(schema).then(function () {
            assert.isTrue(false);
            done();
        }).fail(function () {
            assert.isUndefined(schema.__$validated);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("mainSchema should fail compilation on its own", function (done) {
        var validator = new ZSchema();
        validator.compileSchema(mainSchema).then(function (report) {
            assert.isFalse(report.valid);
            done();
        }).fail(function (err) {
            assert.isDefined(err);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("after compiling schemaA and schemaB, mainSchema compilation should pass", function (done) {
        var validator = new ZSchema();
        validator.compileSchema(schemaA).then(function () {
            return validator.compileSchema(schemaB).then(function () {
                return validator.compileSchema(mainSchema).then(function () {
                    done();
                });
            });
        }).fail(function (err) {
            assert.isUndefined(err);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

});

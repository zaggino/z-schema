/*jshint strict:false, loopfunc:true*/
/*global beforeEach, describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/13", function () {

    var schemaA;
    var schemaB;
    var mainSchema;

    beforeEach(function () {
        schemaA = {id: "schemaA", type: "integer"};
        schemaB = {id: "schemaB", type: "string"};
        mainSchema = {
            id: "mainSchema",
            type: "object",
            properties: {
                a: {"$ref": "schemaA"},
                b: {"$ref": "schemaB"},
                c: {"enum": ["C"]}
            }
        };
    });

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

    it("mainSchema should fail compilation with only one schema", function (done) {
        var validator = new ZSchema();
        validator.compileSchema([mainSchema, schemaA], function (err) {
            try {
                assert.isDefined(err);
                done();
            } catch (e) {
                done(e);
            }
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

    it("compile multiple schemas at once in correct order", function (done) {
        var validator = new ZSchema();
        validator.compileSchema([schemaA, schemaB, mainSchema]).then(function () {
            assert.isTrue(schemaA.__$compiled);
            assert.isTrue(schemaB.__$compiled);
            assert.isTrue(mainSchema.__$compiled);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("compile multiple schemas at once in any order", function (done) {
        var validator = new ZSchema();
        validator.compileSchema([schemaA, mainSchema, schemaB]).then(function () {
            assert.isTrue(schemaA.__$compiled);
            assert.isTrue(schemaB.__$compiled);
            assert.isTrue(mainSchema.__$compiled);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("compile multiple schemas should not run forever if not resolvable", function (done) {
        var validator = new ZSchema();
        validator.compileSchema([schemaA, mainSchema]).catch(function (err) {
            assert.isTrue(err.errors.length > 0);
            done();
        });
    });

    it("should validate with mainSchema", function (done) {
        var validator = new ZSchema();
        validator.compileSchema([schemaA, schemaB, mainSchema]).then(function () {
            return validator.validate({a: 1, b: "b", c: "C"}, mainSchema).then(function (report) {
                assert.isTrue(report.valid);
                done();
            });
        }).fail(function (err) {
            assert.isUndefined(err);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

    it("should not validate with mainSchema", function (done) {
        var validator = new ZSchema();
        validator.compileSchema([schemaA, schemaB, mainSchema]).then(function () {
            return validator.validate({a: "a", b: 2, c: "X"}, mainSchema).then(function () {
                assert.isTrue(false);
            });
        }).fail(function (err) {
            assert.isTrue(err.errors.length === 3);
            done();
        }).fail(function (e) {
            done(e);
        });
    });

});

/*jshint strict:false, loopfunc:true*/
/*global beforeEach, describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/23", function () {

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
        var validator = new ZSchema({ sync: true });
        validator.compileSchema(schema);
        assert.isTrue(schema.__$compiled);
        done();
    });

    it("should erase compilation marks from schema if it failed to compile", function (done) {
        var schema = { $ref: "woohooo" };
        var validator = new ZSchema({ sync: true });
        try {
            validator.compileSchema(schema);
        } catch (e) {
            assert.notOk(schema.__$compiled);
            done();
        }
    });

    it("should add validation marks to a schema if it passed validation", function (done) {
        var schema = {id: "schemaA", type: "integer"};
        var validator = new ZSchema({ sync: true });
        validator.validateSchema(schema);
        assert.isTrue(schema.__$validated);
        done();
    });

    it("should erase validation marks from schema if it failed to validate", function (done) {
        var schema = {id: "schemaA", type: "woohooo"};
        var validator = new ZSchema({ sync: true });
        try {
            validator.validateSchema(schema);
        } catch (e) {
            assert.isUndefined(schema.__$validated);
            done();
        }
    });

    it("mainSchema should fail compilation on its own", function (done) {
        var validator = new ZSchema({ sync: true });
        try {
            validator.compileSchema(mainSchema);
        } catch (e) {
            done();
        }
    });

    it("after compiling schemaA and schemaB, mainSchema compilation should pass", function (done) {
        var validator = new ZSchema({ sync: true });
        validator.compileSchema(schemaA);
        validator.compileSchema(schemaB);
        validator.compileSchema(mainSchema);
        done();
    });

    it("compile multiple schemas at once in correct order", function (done) {
        var validator = new ZSchema({ sync: true });
        validator.compileSchema([schemaA, schemaB, mainSchema]);
        done();
    });

    it("compile multiple schemas at once in any order", function (done) {
        var validator = new ZSchema({ sync: true });
        validator.compileSchema([schemaA, mainSchema, schemaB]);
        assert.isTrue(schemaA.__$compiled);
        assert.isTrue(schemaB.__$compiled);
        assert.isTrue(mainSchema.__$compiled);
        done();
    });

    it("compile multiple schemas should not run forever if not resolvable", function (done) {
        var validator = new ZSchema({ sync: true });
        try {
            validator.compileSchema([schemaA, mainSchema]);
        } catch (e) {
            done();
        }
    });

    it("should validate with mainSchema", function (done) {
        var validator = new ZSchema({ sync: true });
        validator.compileSchema([schemaA, schemaB, mainSchema]);
        var valid = validator.validate({a: 1, b: "b", c: "C"}, mainSchema);
        assert.isTrue(valid);
        done();
    });

    it("should not validate with mainSchema", function (done) {
        var validator = new ZSchema({ sync: true });
        validator.compileSchema([schemaA, schemaB, mainSchema]);
        var valid = validator.validate({a: "a", b: 2, c: "X"}, mainSchema);
        assert.isFalse(valid);
        done();
    });

});

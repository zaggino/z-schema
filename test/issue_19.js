/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/19", function () {

    it("should validate sync succesfully (after compiling)", function (done) {
        var validator = new ZSchema({
            sync: true
        });
        var schema = {
            "$schema": "http://json-schema.org/schema#",
            "properties": { "text": { "type": "string" } },
            "type": "object"
        };
        var json = { "text": "o" };
        var valid = validator.validate(json, schema);
        try {
            assert.isTrue(valid);
        } catch (e) {
            return done(e);
        }
        done();
    });
    
    it("should fail to validate (after compiling)", function (done) {
        var validator = new ZSchema({
            sync: true
        });
        var schema = {
            "$schema": "http://json-schema.org/schema#",
            "properties": { "text": { "type": "string" } },
            "type": "object"
        };
        var json = { "text": 5 };
        var valid = validator.validate(json, schema);
        try {
            assert.isFalse(valid);
            assert.ok(validator.getLastError());
        } catch (e) {
            return done(e);
        }
        done();
    });

});

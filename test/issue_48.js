/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/48", function () {

    var schema = {
        type: "string",
        format: "email"
    };

    it("should pass validation #1", function (done) {
        var validator = new ZSchema({ sync: true });
        var valid = validator.validate("zaggino@gmail.com", schema);
        try {
            assert.isTrue(valid);
            done();
        } catch (e) {
            done(e);
        }
    });

    it("should pass validation #2 (without email strict mode)", function (done) {
        var validator = new ZSchema({ sync: true });
        var valid = validator.validate("foo@bar.baz", schema);
        try {
            assert.isTrue(valid);
            done();
        } catch (e) {
            done(e);
        }
    });

    it("should not pass validation #2 (with email strict mode)", function (done) {
        var validator = new ZSchema({ sync: true, strictEmails: true });
        var valid = validator.validate("foo@bar.baz", schema);
        try {
            assert.isFalse(valid);
            done();
        } catch (e) {
            done(e);
        }
    });

});

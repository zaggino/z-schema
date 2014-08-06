/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/49", function () {

    var schema = {
        type: "string",
        pattern: "^[0-9]{1}[0-9]{3}(\\s)?[A-Za-z]{2}$"
    };

    it("should pass validation #1", function (done) {
        var validator = new ZSchema({ sync: true });
        var valid = validator.validate("0000 aa", schema);
        try {
            assert.isTrue(valid);
            done();
        } catch (e) {
            console.log(validator.getLastError());
            done(e);
        }
    });

});

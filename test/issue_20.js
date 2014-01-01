/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/20", function () {

    it("should fail schema validation", function (done) {
        var validator = new ZSchema();
        validator.validateSchema("bogus schema here", function (err) {
            assert.ok(err);
            done();
        });
    });

});

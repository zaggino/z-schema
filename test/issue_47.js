/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var fs = require("fs");
var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/47", function () {

    var draft4 = String(fs.readFileSync(__dirname + "/issue47/draft4.json"));
    var modifiedSchema = JSON.parse(fs.readFileSync(__dirname + "/issue47/swagger_draft_modified.json"));
    var realSchema = JSON.parse(fs.readFileSync(__dirname + "/issue47/swagger_draft.json"));
    var json = JSON.parse(fs.readFileSync(__dirname + "/issue47/sample.json"));

    ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", draft4); // Correct URL
    ZSchema.setRemoteReference("http://json-schema.orgx/draft-04/schema", draft4); // Modified URL

    it("should pass validation with modified url schema", function (done) {
        var validator = new ZSchema({ sync: true });
        var valid = validator.validate(json, modifiedSchema);
        try {
            assert.isTrue(valid);
            done();
        } catch (e) {
            done(e);
        }
    });

    it("should pass validation with real url schema", function (done) {
        var validator = new ZSchema({ sync: true });
        var valid = validator.validate(json, realSchema);
        try {
            assert.isTrue(valid);
            done();
        } catch (e) {
            done(e);
        }
    });

});

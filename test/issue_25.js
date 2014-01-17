/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("https://github.com/zaggino/z-schema/issues/25", function () {

    var objectToValidate = {
        "ipAddress": "127.0.0.1"
    };

    var schemaForObject = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "type": "object",
        "properties": {
            "ipAddress": {
                "type": "string",
                "oneOf": [
                    {
                        "format": "hostname"
                    },
                    {
                        "format": "ipv4"
                    },
                    {
                        "format": "ipv6"
                    }
                ]
            }
        }
    };

    it("should validate by schema successfully", function (done) {
        ZSchema.validate(objectToValidate, schemaForObject, function (err, report) {
            try {
                assert.isNull(err);
                assert.isTrue(report.valid);
            } catch (e) {
                return done(e);
            }
            done();
        });
    });

});

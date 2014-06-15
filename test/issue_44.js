/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

var ZSchema = require("../src/ZSchema");

describe("https://github.com/zaggino/z-schema/issues/44", function () {

    var schemaA = {
        id: "schemaA",
        type: "string"
    };
    var schemaB = {
        id: "schemaB",
        properties: {
            a: {
                "$ref": "schemaA#"
            }
        }
    };

    it("should not do unresolvable reference because of hash", function (done) {
        var validator = new ZSchema({
            sync: true
        });
        try {
            validator.compileSchema([schemaA, schemaB]);
            done();
        } catch (err) {
            var vError = validator.getLastError();
            if (vError && vError.valid === false) {
                console.log(validator.getLastError());
            } else {
                throw err;
            }
        }
    });

});

/*jshint strict:false, loopfunc:true*/
/*global describe, before, it*/

var ObjectID = require("mongodb").ObjectID;
var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

function hrtoms(t) {
    return (t[0] * 1e9 + t[1]) / 1e6;
}

describe("https://github.com/zaggino/z-schema/issues/39", function() {
    var schema = {
        type: "array",
        items: {
            type: "object",
            properties: {
                "_id": { type: "object" },
                "note": { type: "string", maxLength: 2048 },
                "createdBy": { type: "string", maxLength: 100 },
                "anotherProperty": { type: "object" }
            },
            additionalProperties: false,
        },
        additionalItems: false,
    };

    var notes = [];
    var notesWithoutObjectId = [];

    before(function() {
        // compile schema before using
        var validator = new ZSchema({ sync: true });
        validator.compileSchema(schema);

        // fill the arrays
        var num = 10000, i;

        for(i = 0; i < num; i++) {
            notes.push({
                _id: new ObjectID(),
                note: "Here is my note",
                createdBy: "test@whatever.com",
            });
        }

        for(i = 0; i < num; i++) {
            notesWithoutObjectId.push({
                note: "Here is my note",
                createdBy: "test@whatever.com",
                anotherProperty: {
                    "key": "something so that we have 3 properties here too"
                }
            });
        }
    });

    it("should be fast sync", function(done) {
        this.timeout(30000);

        var validator = new ZSchema({ sync: true });

        var s1 = process.hrtime();
        var valid = validator.validate(notes, schema);
        var e1 = process.hrtime(s1);
        var duration1 = hrtoms(e1);

        var s2 = process.hrtime();
        valid = validator.validate(notesWithoutObjectId, schema);
        var e2 = process.hrtime(s2);
        var duration2 = hrtoms(e2);

        assert.isTrue(duration1 * 2 > duration2);
        assert.isTrue(duration1 < duration2 * 2);

        /*
        console.log(duration1);
        console.log(duration2);
        */

        done();
    });

    it("should be fast async", function(done) {
        this.timeout(30000);

        var validator = new ZSchema({ async: true, noTypeless: true, noExtraKeywords: true, noZeroLengthStrings: true, forceAdditional: true});

        var s1 = process.hrtime();
        validator.validate(notes, schema, function (err, report) {
            var e1 = process.hrtime(s1);
            var duration1 = hrtoms(e1);
            assert.isTrue(report.valid);

            var s2 = process.hrtime();
            validator.validate(notesWithoutObjectId, schema, function (err, report) {
                var e2 = process.hrtime(s2);
                var duration2 = hrtoms(e2);
                assert.isTrue(report.valid);

                /*
                console.log(duration1);
                console.log(duration2);
                */

                assert.isTrue(duration1 * 2 > duration2);
                assert.isTrue(duration1 < duration2 * 2);

                done();
            });

        });
    });
});

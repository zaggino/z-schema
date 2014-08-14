/*jshint -W030 */

"use strict";

var ZSchema = require("../../src/ZSchema");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));

var testSuiteFiles = [
    require("../ZSchemaTestSuite/CustomFormats.js"),
    require("../ZSchemaTestSuite/CustomFormatsAsync.js")
];

describe("ZSchemaTestSuite", function () {

    it("should contain 2 files", function () {
        expect(testSuiteFiles.length).toBe(2);
    });

    testSuiteFiles.forEach(function (testSuite) {

        testSuite.tests.forEach(function (test) {

            var async   = test.async   || testSuite.async   || false,
                options = test.options || testSuite.options || undefined,
                setup   = test.setup   || testSuite.setup,
                data    = test.data    || testSuite.data,
                schema  = test.schema  || testSuite.schema,
                after   = test.after   || testSuite.after;

            !async && it(testSuite.description + ", " + test.description, function () {

                var validator = new ZSchema(options);
                if (setup) { setup(validator, ZSchema); }

                var valid = validator.validate(data, schema);
                var err = validator.getLastError();

                expect(valid).toBe(test.valid);
                if (test.valid === true) {
                    expect(err).toBe(undefined);
                }
                if (after) {
                    after(err, valid);
                }

            });

            async && it(testSuite.description + ", " + test.description, function (done) {

                var validator = new ZSchema(options);
                if (setup) { setup(validator, ZSchema); }

                validator.validate(data, schema, function (err, valid) {
                    expect(valid).toBe(test.valid);
                    if (test.valid === true) {
                        expect(err).toBe(undefined);
                    }
                    if (after) {
                        after(err, valid);
                    }
                    done();
                });

            });

        });

    });

});

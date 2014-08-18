/*jshint -W030 */

"use strict";

var ZSchema = require("../../src/ZSchema");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));

var testSuiteFiles = [
    require("../ZSchemaTestSuite/CustomFormats.js"),
    require("../ZSchemaTestSuite/CustomFormatsAsync.js"),
    require("../ZSchemaTestSuite/ForceAdditional.js"),
    require("../ZSchemaTestSuite/ForceItems.js"),
    require("../ZSchemaTestSuite/ForceMaxLength.js"),
    require("../ZSchemaTestSuite/ForceProperties.js"),
    require("../ZSchemaTestSuite/IgnoreUnresolvableReferences.js"),
    require("../ZSchemaTestSuite/AssumeAdditional.js"),
    require("../ZSchemaTestSuite/NoEmptyStrings.js"),
    require("../ZSchemaTestSuite/NoTypeless.js"),
    require("../ZSchemaTestSuite/NoExtraKeywords.js")
];

describe("ZSchemaTestSuite", function () {

    var idx = testSuiteFiles.length;
    while (idx--) {
        if (testSuiteFiles[idx] == null) {
            testSuiteFiles.splice(idx, 1);
        }
    }

    it("should contain 11 files", function () {
        expect(testSuiteFiles.length).toBe(11);
    });

    testSuiteFiles.forEach(function (testSuite) {

        testSuite.tests.forEach(function (test) {

            var data = test.data;
            if (typeof data === "undefined") {
                data = testSuite.data;
            }

            var async               = test.async              || testSuite.async   || false,
                options             = test.options            || testSuite.options || undefined,
                setup               = test.setup              || testSuite.setup,
                schema              = test.schema             || testSuite.schema,
                after               = test.after              || testSuite.after,
                validateSchemaOnly  = test.validateSchemaOnly || testSuite.validateSchemaOnly;

            !async && it(testSuite.description + ", " + test.description, function () {

                var validator = new ZSchema(options);
                if (setup) { setup(validator, ZSchema); }

                var valid;
                if (validateSchemaOnly) {
                    valid = validator.validateSchema(schema);
                } else {
                    valid = validator.validate(data, schema);
                }
                var err = validator.getLastError();

                expect(typeof valid).toBe("boolean", "returned response is not a boolean");
                expect(valid).toBe(test.valid, "test result doesn't match expected test result");
                if (test.valid === true) {
                    expect(err).toBe(undefined, "errors are not undefined when test is valid");
                }
                if (after) {
                    after(err, valid);
                }

            });

            async && it(testSuite.description + ", " + test.description, function (done) {

                var validator = new ZSchema(options);
                if (setup) { setup(validator, ZSchema); }

                // see http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony
                var zalgo = false;

                var result = validator.validate(data, schema, function (err, valid) {
                    // make sure callback wasn't called synchronously
                    expect(zalgo).toBe(true, "callback was fired in synchronous way");
                    expect(typeof valid).toBe("boolean", "returned response is not a boolean");
                    expect(valid).toBe(test.valid, "test result doesn't match expected test result");
                    if (test.valid === true) {
                        expect(err).toBe(undefined, "errors are not undefined when test is valid");
                    }
                    if (after) {
                        after(err, valid);
                    }
                    done();

                });

                // never return anything when callback is specified
                expect(result).toBe(undefined, "validator returned something else than undefined in callback mode");
                zalgo = true;

            });

        });

    });

});

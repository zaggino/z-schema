"use strict";

var ZSchema = require("../../src/ZSchema");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));

var testSuiteFiles = [
    require("../ZSchemaTestSuite/CustomFormats.js")
];

describe("ZSchemaTestSuite", function () {

    it("should contain 1 file", function () {
        expect(testSuiteFiles.length).toBe(1);
    });

    testSuiteFiles.forEach(function (testSuite) {

        testSuite.tests.forEach(function (test) {

            it(testSuite.description + ", " + test.description, function () {

                var options = test.options || testSuite.options || undefined;
                var validator = new ZSchema(options);

                var setup = test.setup || testSuite.setup;
                if (setup) {
                    setup(validator, ZSchema);
                }

                var data = test.data;
                var schema = test.schema || testSuite.schema;

                var valid = validator.validate(data, schema);
                expect(valid).toBe(test.valid);

                if (test.valid === true) {
                    expect(validator.getLastError()).toBe(null);
                }

            });

        });

    });

});

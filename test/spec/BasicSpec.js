"use strict";

var ZSchema = require("../../src/ZSchema");

ZSchema.setRemoteReference("http://json-schema.org/draft-04/schema", require("../files/draft-04-schema.json"));
ZSchema.setRemoteReference("http://localhost:1234/integer.json", require("../jsonSchemaTestSuite/remotes/integer.json"));
ZSchema.setRemoteReference("http://localhost:1234/subSchemas.json", require("../jsonSchemaTestSuite/remotes/subSchemas.json"));
ZSchema.setRemoteReference("http://localhost:1234/folder/folderInteger.json", require("../jsonSchemaTestSuite/remotes/folder/folderInteger.json"));

describe("Basic", function () {

    it("ZSchema constructor should take one argument - options", function () {
        expect(ZSchema.length).toBe(1);
    });

    it("Work in progress test...", function () {
        var validator = new ZSchema();

        var schema = {
            "id": "http://my.site/myschema#",
            "$ref": "#/definitions/schema2",
            "definitions": {
                "schema1": {
                    "id": "schema1",
                    "type": "integer"
                },
                "schema2": {
                    "type": "array",
                    "items": {
                        "$ref": "schema1"
                    }
                }
            }
        };

        var data = [1, 2, 3];

        var validSchema = validator.validateSchema(schema);
        expect(validSchema).toBe(true);

        if (!validSchema) {
            console.log(validator.getLastError());
            return;
        }

        var valid = validator.validate(data, schema);
        expect(valid).toBe(true);

        if (!valid) {
            console.log(validator.getLastError());
            return;
        }

    });

});

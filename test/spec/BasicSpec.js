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
            "id": "http://localhost:1234/",
            "items": {
                "id": "folder/",
                "items": { "$ref": "folderInteger.json" }
            }
        };
        var data = [[1]];
        var valid = validator.validate(data, schema);
        if (!valid) {
            console.log(validator.getLastError());
        }
        expect(valid).toBe(true);
    });

});

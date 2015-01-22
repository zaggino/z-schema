/*jshint node:true*/
/*global require*/

"use strict";

var Tester = require("./tester");

var ZSchema3 = require("../src/ZSchema");
var ZSchema = require("z-schema");
var JaySchema = require("jayschema");
var jjv = require("jjv");
var JsonSchema = require("jsonschema");
var tv4 = require("tv4");
var JsonModel = require("json-model");
var IsMyJsonValid = require("is-my-json-valid");

Tester.registerValidator({
    name: "z-schema-3",
    setup: function () {
        return new ZSchema3({
            ignoreUnresolvableReferences: true
        });
    },
    test: function (instance, json, schema) {
        return instance.validate(json, schema);
    }
});

Tester.registerValidator({
    name: "z-schema-2",
    setup: function () {
        return new ZSchema({ sync: true });
    },
    test: function (instance, json, schema) {
        return instance.validate(json, schema) === true;
    }
});

Tester.registerValidator({
    name: "is-my-json-valid",
    setup: function () {
        return IsMyJsonValid;
    },
    test: function (validator, json, schema) {
        // If we're repeatedly testing the same schema, use the existing validate
        if (this.lastSchema !== schema) {
            this.lastSchema = schema;
            this.validate = validator(schema);
        }
        return this.validate(json);
    }
});

Tester.registerValidator({
    name: "jayschema",
    setup: function () {
        return new JaySchema();
    },
    test: function (instance, json, schema) {
        return instance.validate(json, schema).length === 0;
    }
});

Tester.registerValidator({
    name: "jjv",
    setup: function () {
        return jjv();
    },
    test: function (instance, json, schema) {
        return instance.validate(schema, json) === null;
    }
});

Tester.registerValidator({
    name: "json-model",
    setup: function () {
        return JsonModel;
    },
    test: function (instance, json, schema) {
        // If we're repeatedly testing the same schema, use the existing validator
        if (this.lastSchema !== schema) {
            this.lastSchema = schema;
            this.validator = JsonModel.validator(schema);
        }
        return this.validator(json).valid === true;
    }
});

Tester.registerValidator({
    name: "jsonschema",
    setup: function () {
        return new JsonSchema.Validator();
    },
    test: function (instance, json, schema) {
        return instance.validate(json, schema).errors.length === 0;
    }
});

Tester.registerValidator({
    name: "tv4",
    setup: function () {
        return tv4;
    },
    test: function (instance, json, schema) {
        return instance.validateResult(json, schema).valid === true;
    }
});

var basicObject = require("./basic_object.json");
var basicSchema = require("./basic_schema_v4.json");
Tester.runOne("basicObject", basicObject, basicSchema, true);

var advancedObject = require("./advanced_object.json");
var advancedSchema = require("./advanced_schema_v4.json");
Tester.runOne("advancedObject", advancedObject, advancedSchema, true);

Tester.runDirectory(__dirname + "/../test/jsonSchemaTestSuite/tests/draft4/", {
    excludeFiles: ["optional/zeroTerminatedFloats.json"],
    excludeTests: [
        // no-one supports unicode tests
        "maxLength validation, two supplementary Unicode code points is long enough",
        "minLength validation, one supplementary Unicode code point is not long enough",
        // these two tests consider different uri then is desired to be valid
        "validation of URIs, an invalid URI",
        "validation of URIs, an invalid URI though valid URI reference",
        // these tests require validator to work with remote schema which they can't download in sync test
        "valid definition, valid definition schema",
        "invalid definition, invalid definition schema",
        "remote ref, containing refs itself, remote ref valid",
        "remote ref, containing refs itself, remote ref invalid",
        "remote ref, remote ref valid",
        "remote ref, remote ref invalid",
        "fragment within remote ref, remote fragment valid",
        "fragment within remote ref, remote fragment invalid",
        "ref within remote ref, ref within ref valid",
        "ref within remote ref, ref within ref invalid",
        "change resolution scope, changed scope ref valid",
        "change resolution scope, changed scope ref invalid"
    ]
});

Tester.saveResults("results.html", "results.template");

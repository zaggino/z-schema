'use strict';

var Tester = require('./tester');
var ZSchema = require('../src/ZSchema');
var Jassi = require('jassi');
var JaySchema = require('jayschema');
var JsonSchemaSuite = require('json-schema-suite');
var tv4 = require('tv4');

Tester.registerValidator({
    name: 'z-schema',
    setup: function () {
        return new ZSchema({ sync: true });
    },
    test: function (instance, json, schema) {
        return instance.validate(json, schema) === true;
    }
});

Tester.registerValidator({
    name: 'jassi',
    setup: function () {
        return Jassi;
    },
    test: function (instance, json, schema) {
        return instance(json, schema).length === 0;
    }
});

Tester.registerValidator({
    name: 'jayschema',
    setup: function () {
        return new JaySchema();
    },
    test: function (instance, json, schema) {
        return instance.validate(json, schema).length === 0;
    }
});

Tester.registerValidator({
    name: 'json-schema-suite',
    setup: function () {
        return new JsonSchemaSuite.Validator();
    },
    test: function (instance, json, schema) {
        return instance.validateRaw(schema, json) === true;
    }
});

Tester.registerValidator({
    name: 'tv4',
    setup: function () {
        return tv4;
    },
    test: function (instance, json, schema) {
        return instance.validateResult(json, schema).valid === true;
    }
});

var basicObject = require('./basic_object.json');
var basicSchema = require('./basic_schema_v4.json');
Tester.runOne('basicObject', basicObject, basicSchema, true);

var advancedObject = require('./advanced_object.json');
var advancedSchema = require('./advanced_schema_v4.json');
Tester.runOne('advancedObject', advancedObject, advancedSchema, true);

Tester.runDirectory(__dirname + '/../json_schema_test_suite/tests/draft4/', {
    excludeFiles: ['optional/zeroTerminatedFloats.json'],
    excludeTests: ['an invalid URI',
                   'an invalid URI though valid URI reference']
});

Tester.saveResults('results.html', 'results.template');

'use strict';

var Benchmark = require('benchmark');
var assert = require('assert');

// http://json-schema.org/example1.html
var basicObject = require('./basic_object.json');
var basicSchema = require('./basic_schema_v4.json');
var advancedObject = require('./advanced_object.json');
var advancedSchema = require('./advanced_schema_v4.json');

// tv4 - supports version 4 (Public Domain)
var tv4 = require('tv4');
var result = tv4.validateResult(basicObject, basicSchema);
assert.deepEqual(result.valid, true, 'tv4 is expected to validate basic truthfully');
var result = tv4.validateResult(advancedObject, advancedSchema);
assert.deepEqual(result.valid, true, 'tv4 is expected to validate advanced truthfully');

// JaySchema for Node.js - supports version 4 (BSD)
var JaySchema = require('jayschema');
var js = new JaySchema();
var errs = js.validate(basicObject, basicSchema);
assert.deepEqual(errs.length, 0, 'JaySchema is expected to validate basic truthfully');
var errs = js.validate(advancedObject, advancedSchema);
assert.deepEqual(errs.length, 0, 'JaySchema is expected to validate advanced truthfully');

// z-schema for Node.js - supports version 4 (MIT)
var ZSchema = require('z-schema');
var zs = new ZSchema({ sync: true });
var valid = zs.validate(basicObject, basicSchema);
assert.deepEqual(valid, true, 'z-schema is expected to validate basic truthfully');
var valid = zs.validate(advancedObject, advancedSchema);
assert.deepEqual(valid, true, 'z-schema is expected to validate advanced truthfully');

new Benchmark.Suite()
    // add tests
    .add('tv4#basic', function () {
        tv4.validateResult(basicObject, basicSchema);
    })
    .add('jayschema#basic', function () {
        js.validate(basicObject, basicSchema);
    })
    .add('z-schema#basic', function () {
        zs.validate(basicObject, basicSchema);
    })
    // add listeners
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').pluck('name'));
    })
    // run sync
    .run({
        'async': false
    });

new Benchmark.Suite()
    // add tests
    .add('tv4#advanced', function () {
        tv4.validateResult(advancedObject, advancedSchema);
    })
    .add('jayschema#advanced', function () {
        js.validate(advancedObject, advancedSchema);
    })
    .add('z-schema#advanced', function () {
        zs.validate(advancedObject, advancedSchema);
    })
    // add listeners
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').pluck('name'));
    })
    // run sync
    .run({
        'async': false
    });

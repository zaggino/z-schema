'use strict';

var _           = require('lodash'),
    fs          = require('fs'),
    path        = require('path'),
    Benchmark   = require('benchmark'),
    Mustache    = require('mustache');

var Tester = {
    validators: [],
    results: []
};

Tester.registerValidator = function (obj) {
    this.validators.push(obj);
};

Tester.runOne = function (testName, json, schema, expectedResult) {
    var suite = new Benchmark.Suite();

    this.validators.forEach(function (validatorObject) {
        // setup instance
        var instance = validatorObject.setup();
        // verify that validator really works
        var givenResult = validatorObject.test(instance, json, schema);
        if (givenResult !== expectedResult) {
            return;
            // throw new Error(validatorObject.name + ' failed test ' + testName);
        }
        // add it to benchmark
        suite.add(validatorObject.name + '#' + testName, function () {
            validatorObject.test(instance, json, schema);
        });
    });

    suite
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

    var fastestName = suite.filter('fastest').pluck('name').toString();
    var suiteResult = {
        name: testName,
        results: []
    };
    this.validators.forEach(function (validatorObject) {
        var results = _.find(suite, function (obj) {
            return validatorObject.name === obj.name.substring(0, obj.name.indexOf('#'));
        });
        if (results) {
            suiteResult.results.push({
                hz: parseInt(results.hz, 10),
                fastest: fastestName === results.name
            });
        } else {
            suiteResult.results.push({
                hz: -1,
                failed: true
            });
        }
    });
    this.results.push(suiteResult);
};

Tester.saveResults = function (filename, templateName) {
    filename = [__dirname, filename].join(path.sep);

    var template = fs.readFileSync([__dirname, templateName].join(path.sep)).toString();
    var html = Mustache.render(template, {
        validators: this.validators,
        results: this.results
    });

    fs.writeFileSync(filename, html);
    console.log(filename + ' created!');
};

module.exports = Tester;

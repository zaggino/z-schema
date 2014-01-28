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
        var givenResult;
        try {
            givenResult = validatorObject.test(instance, json, schema);
        } catch (e) {
            givenResult = e;
        }
        if (givenResult !== expectedResult) {
            console.warn(validatorObject.name + ' failed the test ' + testName);
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

    console.log('-');

    var fastest = 0;
    var suiteResult = {
        name: testName,
        results: []
    };
    this.validators.forEach(function (validatorObject) {
        var ops;
        var results = _.find(suite, function (obj) {
            return validatorObject.name === obj.name.substring(0, obj.name.indexOf('#'));
        });
        if (results) {
            ops = parseInt(results.hz, 10);
            suiteResult.results.push({
                hz: ops
            });
        } else {
            ops = -1;
            suiteResult.results.push({
                hz: ops,
                failed: true
            });
        }
        if (ops > fastest) { fastest = ops; }
    });
    suiteResult.results.forEach(function (result) {
        if (result.hz === fastest) {
            result.fastest = true;
        }
        result.percentage = parseInt(result.hz / fastest * 100, 10);
    });
    this.results.push(suiteResult);
};

Tester.runFileContent = function (json) {
    json.forEach(function (testSuite) {
        testSuite.tests.forEach(function (test) {
            var testName = [testSuite.description, test.description].join(', ');
            this.runOne(testName, test.data, testSuite.schema, test.valid);
        }, this);
    }, this);
};

Tester.runFile = function (filename) {
    var content = JSON.parse(fs.readFileSync(filename).toString());
    this.runFileContent(content);
};

function mergeObjects(dest, src) {
    for (var key in src) {
        if (!dest[key]) {
            dest[key] = src[key];
        } else {
            throw new Error('Object merge failed on key: ' + key);
        }
    }
}

function readDirToObject(dirpath, prefix) {
    var obj = {};
    prefix = prefix || '';
    var files = fs.readdirSync(dirpath);
    files.forEach(function (fileName) {
        var stats = fs.statSync(dirpath + fileName);
        if (stats.isDirectory()) {
            var o = readDirToObject(dirpath + fileName + '/', fileName + '/');
            mergeObjects(obj, o);
        } else {
            var fileContents = fs.readFileSync(dirpath + fileName, 'utf8');
            var json = JSON.parse(fileContents);
            obj[prefix + fileName] = json;
        }
    });
    return obj;
}

Tester.runDirectory = function (directory) {
    var files = readDirToObject(directory);
    for (var fileName in files) {
        Tester.runFileContent(files[fileName]);
    }
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

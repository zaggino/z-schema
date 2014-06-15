/*jshint strict:false, loopfunc:true*/
/*global before, describe, it */

var fs = require('fs');
var ZSchema = require('../src/ZSchema');

// preload files here because we want to run tests without localhost server
ZSchema.setRemoteReference('http://localhost:1234/integer.json',
                           fs.readFileSync(__dirname + '/../json_schema_test_suite/remotes/integer.json', 'utf8'));
ZSchema.setRemoteReference('http://localhost:1234/subSchemas.json',
                           fs.readFileSync(__dirname + '/../json_schema_test_suite/remotes/subSchemas.json', 'utf8'));
ZSchema.setRemoteReference('http://localhost:1234/folder/folderInteger.json',
                           fs.readFileSync(__dirname + '/../json_schema_test_suite/remotes/folder/folderInteger.json', 'utf8'));

describe('Validations for json schema files:', function () {

    var testDir = __dirname + '/../json_schema_test_suite/tests/draft4/';

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
        }, this);
        return obj;
    }

    before(function (done) {
        done();
    });

    var testFiles = readDirToObject(testDir);
    for (var file in testFiles) {

        // don't know how to pass this in JavaScript
        if (file === 'optional/zeroTerminatedFloats.json') {
            continue;
        }

        describe(file, function () {

            var fileContent = testFiles[file];
            fileContent.forEach(function (testSuite) {

                testSuite.tests.forEach(function (testDefinition) {

                    // skip because of https://github.com/zaggino/z-schema/issues/18
                    if (testDefinition.description === 'an invalid URI' ||
                        testDefinition.description === 'an invalid URI though valid URI reference' ||
                        testDefinition.description.indexOf('supplementary Unicode code point') !== -1) { return; }

                    it('/ ' + testSuite.description + ' / ' + testDefinition.description, function (done) {

                        // console.log(testSuite.description + '/' + testDefinition.description);

                        ZSchema.validate(testDefinition.data, testSuite.schema, function (err, report) {

                            var valid = report && report.valid || false;

                            if (valid === testDefinition.valid) {
                                done();
                            } else {
                                if (testDefinition.valid === true) {
                                    console.log(report || err);
                                    throw new Error('Test should pass, but failed.');
                                } else {
                                    throw new Error('Test should fail, but passed.');
                                }
                            }

                        });

                    });

                });
            });
        });
    }
});

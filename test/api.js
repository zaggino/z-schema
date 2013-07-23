/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Validations for API:', function () {

    var compiledSchema = null;
    var schema = {
        '$ref': 'http://json-schema.org/draft-04/schema#'
    };

    it('should compile official schema', function (done) {
        var ins = new zSchema();
        ins.compileSchema(schema, function (err, sch) {
            assert.isUndefined(err);
            compiledSchema = sch;
            done();
        });
    });

    it('should validate sync with compiled schema #1', function (done) {
        var valid = {
            'type': 'string'
        };
        var ins = new zSchema();
        var report = ins.validateWithCompiled(valid, compiledSchema);
        assert.isTrue(report.valid);
        done();
    });

    it('should validate sync with compiled schema #2', function (done) {
        var valid = {
            'type': 'abrakadabra'
        };
        var ins = new zSchema();
        var report = ins.validateWithCompiled(valid, compiledSchema);
        assert.isFalse(report.valid);
        done();
    });

});
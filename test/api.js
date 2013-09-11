/*jshint strict:false*/
/*global describe, it*/

var zSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Validations for API:', function () {

    this.timeout(10000);

    var compiledSchema = null;
    var schema = {
        '$ref': 'http://json-schema.org/draft-04/schema#'
    };

    it('should compile official schema', function (done) {
        var ins = new zSchema();
        ins.compileSchema(schema, function (err, sch) {
            assert.isNull(err);
            compiledSchema = sch;
            done();
        });
    });
    it('should return with resolved with promise for compiled schema #1', function (done) {
        var valid = {
            'type': 'string'
        };
        var ins = new zSchema();
        ins.validate(valid, compiledSchema)
            .then(function (report) {
                assert.isTrue(report.valid);
                done();
            })
            .done();
    });
    it('should return with rejected promise for compiled schema #2', function (done) {
        var valid = {
            'type': 'abrakadabra'
        };
        var ins = new zSchema();
        ins.validate(valid, compiledSchema)
            .fail(function (err) {
                assert.instanceOf(err, Error);
                done();
            })
            .done();
    });
    it('should return resolved promise for schema', function (done) {
        var sch = {
            'type': 'string'
        };
        var ins = new zSchema();
        ins.validate(sch, compiledSchema)
            .then(function (report) {
                assert.isTrue(report.valid);
                done();
            })
            .done();
    });
    it('should return rejected promise for schema', function (done) {
        var sch = {
            'type': null
        };
        var ins = new zSchema();
        ins.validate(sch, compiledSchema)
            .fail(function (err) {
                assert.instanceOf(err, Error);
                done();
            })
            .done();
    });
});

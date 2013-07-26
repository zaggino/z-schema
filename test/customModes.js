/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Custom functionality validation:', function () {

    it('should fail validating in strict mode', function (done) {
        var validator = new zSchema({
            strict: true
        });
        var schema = {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'one': {
                        'type': 'number'
                    }
                }
            }
        };
        validator.compileSchema(schema, function (err, compiled) {
            assert.isTrue(err.length === 2);
            done();
        });
    });

    it('should pass validating in default mode', function (done) {
        var validator = new zSchema({
            // strict: true
        });
        var schema = {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'one': {
                        'type': 'number'
                    }
                }
            }
        };
        validator.compileSchema(schema, function (err, compiled) {
            assert.isTrue(!err);
            done();
        });
    });

    it('should fail validating in noZeroLengthStrings mode', function (done) {
        var validator = new zSchema({
            noZeroLengthStrings: true
        });
        var schema = {
            'type': 'string'
        };
        validator.validate('', schema, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });

    it('should pass validating in noZeroLengthStrings mode', function (done) {
        var validator = new zSchema({
            // noZeroLengthStrings: true
        });
        var schema = {
            'type': 'string'
        };
        validator.validate('', schema, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });

});
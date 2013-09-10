/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Custom functionality validation:', function () {

    it('should fail validating in forceAdditional mode', function (done) {
        var validator = new zSchema({
            forceAdditional: true
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
            assert.isTrue(err.errors.length === 2);
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
        validator.validate('', schema, function (err, report) {
            assert.instanceOf(err, Error);
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
        validator.validate('', schema, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should fail validating in noTypeless mode', function (done) {
        var validator = new zSchema({
            noTypeless: true
        });
        var schema = {
            'type': 'array',
            'items': {}
        };
        validator.compileSchema(schema, function (err, compiled) {
            assert.isTrue(err.errors.length === 1);
            done();
        });
    });

    it('should pass validating in noTypeless mode', function (done) {
        var validator = new zSchema({
            noTypeless: true
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

});
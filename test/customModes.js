/*jshint strict:false*/
/*global describe, it*/

var ZSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Custom functionality validation:', function () {

    it('should fail validating in forceAdditional mode', function (done) {
        var validator = new ZSchema({
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
        validator.compileSchema(schema, function (err) {
            assert.isTrue(err.errors.length === 2);
            done();
        });
    });

    it('should pass validating in default mode', function (done) {
        var validator = new ZSchema({
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
        validator.compileSchema(schema, function (err) {
            assert.isTrue(!err);
            done();
        });
    });

    it('should fail validating in noZeroLengthStrings mode', function (done) {
        var validator = new ZSchema({
            noZeroLengthStrings: true
        });
        var schema = {
            'type': 'string'
        };
        validator.validate('', schema, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should pass validating in noZeroLengthStrings mode', function (done) {
        var validator = new ZSchema({
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
        var validator = new ZSchema({
            noTypeless: true
        });
        var schema = {
            'type': 'array',
            'items': {}
        };
        validator.compileSchema(schema, function (err) {
            assert.isTrue(err.errors.length === 1);
            done();
        });
    });

    it('should pass validating in noTypeless mode', function (done) {
        var validator = new ZSchema({
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
        validator.compileSchema(schema, function (err) {
            assert.isTrue(!err);
            done();
        });
    });

});

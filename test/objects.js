/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Validations for object type:', function () {

    it('should pass maxProperties #1', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y'
        }, {
            'type': 'object',
            'maxProperties': 3
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass maxProperties #2', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y'
        }, {
            'type': 'object',
            'maxProperties': 2
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass minProperties #1', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y'
        }, {
            'type': 'object',
            'minProperties': 3
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass minProperties #2', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y'
        }, {
            'type': 'object',
            'minProperties': 4
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass required validation #1', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y'
        }, {
            'type': 'object',
            'required': ['x1']
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass required validation #2', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y',
            'x4': null
        }, {
            'type': 'object',
            'required': ['x4']
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass required validation #1', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y'
        }, {
            'type': 'object',
            'required': 'x1'
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should not pass required validation #2', function (done) {
        zSchema.validate({
            'x1': 'y',
            'x2': 'y',
            'x3': 'y'
        }, {
            'type': 'object',
            'required': []
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass specification example', function (done) {
        var schema = {
            'type': 'object',
            'properties': {
                'p1': {}
            },
            'patternProperties': {
                'p': {},
                '[0-9]': {}
            },
            'additionalProperties': false
        };
        var instance = {
            'p1': true,
            'p2': null,
            'a32&o': 'foobar',
            'apple': 'pie'
        };

        zSchema.validate(instance, schema, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass specification example', function (done) {
        var schema = {
            'type': 'object',
            'properties': {
                'p1': {}
            },
            'patternProperties': {
                'p': {},
                '[0-9]': {}
            },
            'additionalProperties': false
        };
        var instance = {
            'p1': true,
            'p2': null,
            'a32&o': 'foobar',
            '': [],
            'fiddle': 42,
            'apple': 'pie'
        };

        zSchema.validate(instance, schema, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass basic dependencies', function (done) {
        var schema = {
            'type': 'object',
            'dependencies': {
                'a': ['b', 'c', 'd']
            }
        };
        var instance = {
            'a': true,
            'b': null,
            'c': null,
            'd': null,
        };

        zSchema.validate(instance, schema, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass basic dependencies', function (done) {
        var schema = {
            'type': 'object',
            'dependencies': {
                'a': ['b', 'c', 'd']
            }
        };
        var instance = {
            'a': true,
            'c': null,
            'd': null,
        };

        zSchema.validate(instance, schema, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass schema dependencies', function (done) {
        var schema = {
            'type': 'object',
            'dependencies': {
                'a': {
                    'type': 'object',
                    'minProperties': 2
                }
            }
        };
        var instance = {
            'a': null,
            'b': null
        };

        zSchema.validate(instance, schema, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should fail this properties', function (done) {
        var obj = {
            foo: 2,
            bar: 'quux'
        };
        var schema = {
            'properties': {
                'foo': {
                    'type': 'integer'
                },
                'bar': {
                    'type': 'integer'
                }
            }
        };
        zSchema.validate(obj, schema, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should fail on invalid use of required #1', function (done) {
        var schema = {
            'type': 'string',
            'required': true
        };
        zSchema.validate({}, schema, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should fail on invalid use of required #2', function (done) {
        var schema = {
            'type': 'object',
            'properties': {
                'password_current': {
                    'type': 'string',
                    'required': true
                }
            },
            'additionalProperties': false
        };
        zSchema.validate({}, schema, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
});
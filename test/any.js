/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Validations for any type:', function () {

    it('should pass enum test', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'enum': ['x', 'xx', 'xxx']
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass enum test', function (done) {
        zSchema.validate('xxxx', {
            'type': 'string',
            'enum': ['x', 'xx', 'xxx']
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass allOf test', function (done) {
        var schemas = [{
                'type': 'string',
                'minLength': 3
            }, {
                'type': 'string',
                'maxLength': 3
            }];

        zSchema.validate('xxx', {
            'allOf': schemas
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass allOf test', function (done) {
        var schemas = [{
                'type': 'string',
                'minLength': 4
            }, {
                'type': 'string',
                'maxLength': 3
            }];

        zSchema.validate('xxx', {
            'allOf': schemas
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });

    it('should pass anyOf test', function (done) {
        var schemas = [{
                'type': 'string'
            }, {
                'type': 'object'
            }];

        zSchema.validate('xxx', {
            'anyOf': schemas
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass anyOf test', function (done) {
        var schemas = [{
                'type': 'array'
            }, {
                'type': 'object'
            }];

        zSchema.validate('xxx', {
            'anyOf': schemas
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });

    it('should pass oneOf test', function (done) {
        var schemas = [{
                'type': 'string'
            }, {
                'type': 'object'
            }];

        zSchema.validate('xxx', {
            'oneOf': schemas
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass oneOf test', function (done) {
        var schemas = [{
                'type': 'string'
            }, {
                'type': 'string'
            }];

        zSchema.validate('xxx', {
            'oneOf': schemas
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });

    it('should pass "not" test', function (done) {
        zSchema.validate('xxx', {
            'not': {
                'type': 'array'
            }
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass "not" test', function (done) {
        zSchema.validate('xxx', {
            'not': {
                'type': 'string'
            }
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
});
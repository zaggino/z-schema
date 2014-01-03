/*jshint strict:false*/
/*global describe, it*/

var ZSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Validations for any type:', function () {

    it('should pass enum test', function (done) {
        ZSchema.validate('xxx', {
            'type': 'string',
            'enum': ['x', 'xx', 'xxx']
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass enum test', function (done) {
        ZSchema.validate('xxxx', {
            'type': 'string',
            'enum': ['x', 'xx', 'xxx']
        }, function (err) {
            assert.instanceOf(err, Error);
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

        ZSchema.validate('xxx', {
            'allOf': schemas
        }, function (err, report) {
            if (err) {
                console.log(err);
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

        ZSchema.validate('xxx', {
            'allOf': schemas
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should pass anyOf test', function (done) {
        var schemas = [{
                'type': 'string'
            }, {
                'type': 'object'
            }];

        ZSchema.validate('xxx', {
            'anyOf': schemas
        }, function (err, report) {
            if (err) {
                console.log(err);
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

        ZSchema.validate('xxx', {
            'anyOf': schemas
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should pass oneOf test', function (done) {
        var schemas = [{
                'type': 'string'
            }, {
                'type': 'object'
            }];

        ZSchema.validate('xxx', {
            'oneOf': schemas
        }, function (err, report) {
            if (err) {
                console.log(err);
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

        ZSchema.validate('xxx', {
            'oneOf': schemas
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should pass "not" test', function (done) {
        ZSchema.validate('xxx', {
            'not': {
                'type': 'array'
            }
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass "not" test', function (done) {
        ZSchema.validate('xxx', {
            'not': {
                'type': 'string'
            }
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
});

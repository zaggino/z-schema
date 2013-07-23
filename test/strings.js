/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Validations for string type:', function () {

    it('should pass strings with lesser length #1', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'maxLength': 5
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass strings with lesser length #2', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'maxLength': 3
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass strings with lesser length #3', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'maxLength': 1
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass strings with bigger length #1', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'minLength': 1
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass strings with bigger length #2', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'minLength': 3
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass strings with bigger length #3', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'minLength': 5
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    //-- pattern
    it('should accept pattern on strings #1', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'pattern': ''
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should accept pattern on strings #2', function (done) {
        zSchema.validate('xxx', {
            'type': 'number',
            'pattern': ''
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should accept pattern on strings #3', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'pattern': 5
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass pattern validation #1', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'pattern': '^xxx$'
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass pattern validation #2', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'pattern': '^xxxx$'
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });

    zSchema.registerFormat('xstring', function (str) {
        return str === 'xxx';
    });

    it('should pass format validation', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'format': 'xstring'
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass format validation', function (done) {
        zSchema.validate('yyy', {
            'type': 'string',
            'format': 'xstring'
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });

    it('should pass date validation', function (done) {
        zSchema.validate('9999-12-31', {
            'type': 'string',
            'format': 'date'
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
});